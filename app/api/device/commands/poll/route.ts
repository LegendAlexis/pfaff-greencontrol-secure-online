import { NextRequest, NextResponse } from "next/server";
import type {
  CommandAcknowledgement,
  CommandActuator,
} from "../../../../../lib/domain/device-command";
import {
  readDeviceCredentials,
} from "../../../../../lib/domain/device-auth";
import {
  executeDeviceCommandPoll,
  type DeviceCommandPollRepository,
} from "../../../../../lib/services/device-command-poll";
import { createAdminClient } from "../../../../../lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const credentials = readDeviceCredentials(request.headers);
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return response(400, { error: "invalid_json" });
    }

    const admin = createAdminClient();
    const repository: DeviceCommandPollRepository = {
      async findDevice(deviceId) {
        const { data, error } = await admin
          .from("devices")
          .select("id,active,secret_hash")
          .eq("id", deviceId)
          .maybeSingle();

        if (error) throw error;
        return data;
      },

      async acknowledge(deviceId, acknowledgements, acknowledgedAt) {
        if (acknowledgements.length === 0) return true;

        const ids = acknowledgements.map(
          (acknowledgement) => acknowledgement.command_id,
        );
        const { data: stored, error: readError } = await admin
          .from("device_commands")
          .select("id,actuator,sequence,status")
          .eq("device_id", deviceId)
          .in("id", ids);

        if (readError) throw readError;
        if (!acknowledgementsMatch(stored ?? [], acknowledgements)) {
          return false;
        }

        for (const acknowledgement of acknowledgements) {
          const { data, error } = await admin
            .from("device_commands")
            .update({
              status: acknowledgement.status,
              acknowledged_at: acknowledgedAt,
              ack_reason: acknowledgement.reason ?? null,
              actual_state: acknowledgement.actual_state,
            })
            .eq("id", acknowledgement.command_id)
            .eq("device_id", deviceId)
            .eq("actuator", acknowledgement.actuator)
            .eq("sequence", acknowledgement.sequence)
            .in("status", [
              "pending",
              "delivered",
              acknowledgement.status,
            ])
            .select("id")
            .maybeSingle();

          if (error) throw error;
          if (!data) return false;
        }

        return true;
      },

      async findLatestOpenCommand(deviceId, actuator, now) {
        const { data, error } = await admin
          .from("device_commands")
          .select(
            "id,protocol_version,device_id,actuator,command,sequence,payload,created_at,expires_at",
          )
          .eq("device_id", deviceId)
          .eq("actuator", actuator)
          .in("status", ["pending", "delivered"])
          .gt("expires_at", now)
          .order("sequence", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        return data;
      },

      async markDelivered(deviceId, commandId, deliveredAt) {
        const { error } = await admin
          .from("device_commands")
          .update({
            status: "delivered",
            delivered_at: deliveredAt,
          })
          .eq("id", commandId)
          .eq("device_id", deviceId)
          .eq("status", "pending");

        if (error) throw error;
      },
    };

    const result = await executeDeviceCommandPoll({
      credentials,
      body,
      repository,
      now: new Date(),
    });

    return response(result.status, result.body);
  } catch (error) {
    console.error("Device command poll failed:", safeDatabaseError(error));
    return response(500, { error: "command_poll_failed" });
  }
}

function safeDatabaseError(error: unknown) {
  if (!error || typeof error !== "object") {
    return {
      code: null,
      message: error instanceof Error ? error.message : "unknown_error",
      details: null,
      hint: null,
    };
  }

  const candidate = error as Record<string, unknown>;
  return {
    code: safeErrorField(candidate.code),
    message: safeErrorField(candidate.message) ?? "unknown_error",
    details: safeErrorField(candidate.details),
    hint: safeErrorField(candidate.hint),
  };
}

function safeErrorField(value: unknown) {
  return typeof value === "string" ? value : null;
}

function acknowledgementsMatch(
  stored: Array<{
    id: string;
    actuator: string;
    sequence: number;
    status: string;
  }>,
  acknowledgements: CommandAcknowledgement[],
) {
  if (stored.length !== acknowledgements.length) return false;

  const expected = new Set(
    acknowledgements.map(
      (acknowledgement) =>
        `${acknowledgement.command_id}:${acknowledgement.actuator}:${acknowledgement.sequence}`,
    ),
  );

  return stored.every((command) => {
    const acknowledgement = acknowledgements.find(
      (candidate) => candidate.command_id === command.id,
    );
    if (!acknowledgement) return false;

    const identity =
      `${command.id}:${command.actuator as CommandActuator}:${command.sequence}`;
    const statusIsOpen =
      command.status === "pending" || command.status === "delivered";

    return (
      expected.has(identity) &&
      (statusIsOpen || command.status === acknowledgement.status)
    );
  });
}

function response(status: number, body: object) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
