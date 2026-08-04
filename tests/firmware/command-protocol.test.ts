import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const current = new URL(
  "../../firmware/current/Pfaff_GreenControl_Firmware_v1_3_1_GPIO21_windows_off/",
  import.meta.url,
);

async function source(name: string) {
  return readFile(new URL(name, current), "utf8");
}

test("firmware protocol models the three core actuators independently", async () => {
  const header = await source("GCCommandProtocol.h");
  const implementation = await source("GCCommandProtocol.cpp");

  for (const actuator of [
    "Watering",
    "RoofWindow",
    "SideWindow",
  ]) {
    assert.match(header, new RegExp(`\\b${actuator}\\b`));
  }
  for (const wireName of [
    "watering",
    "roof_window",
    "side_window",
  ]) {
    assert.match(implementation, new RegExp(`"${wireName}"`));
  }
  assert.match(header, /uint64_t watering = 0/);
  assert.match(header, /uint64_t roofWindow = 0/);
  assert.match(header, /uint64_t sideWindow = 0/);
});

test("poll parser enforces protocol, one command per actor and typed payloads", async () => {
  const implementation = await source("GCCommandProtocol.cpp");

  assert.match(
    implementation,
    /document\["protocol_version"\] != GC_COMMAND_PROTOCOL_VERSION/,
  );
  assert.match(implementation, /commands\.size\(\) > GC_MAX_POLL_COMMANDS/);
  assert.match(implementation, /actuatorSeen\[actuatorIndex\]/);
  assert.match(implementation, /commandName != "set"/);
  assert.match(implementation, /commandName != "move"/);
  assert.match(implementation, /payload\.size\(\) != 1/);
  assert.match(implementation, /"open"/);
  assert.match(implementation, /"stop"/);
  assert.match(implementation, /"close"/);
});

test("poll request carries separate sequences and pending acknowledgements", async () => {
  const implementation = await source("GCCommandProtocol.cpp");

  assert.match(implementation, /\["last_applied_sequences"\]/);
  assert.match(implementation, /sequenceState\["watering"\]/);
  assert.match(implementation, /sequenceState\["roof_window"\]/);
  assert.match(implementation, /sequenceState\["side_window"\]/);
  assert.match(implementation, /\["acknowledgements"\]/);
  assert.match(implementation, /\["actual_state"\]/);
});

test("NVS state is monotone per actor and retains one pending ACK each", async () => {
  const implementation = await source("GCCommandStateStore.cpp");

  for (const key of [
    "seq_water",
    "seq_roof",
    "seq_side",
    "ack_water",
    "ack_roof",
    "ack_side",
  ]) {
    assert.match(implementation, new RegExp(`"${key}"`));
  }

  assert.match(implementation, /if \(sequence < current\) return false/);
  assert.match(implementation, /if \(sequence == current\) return true/);
  assert.match(implementation, /putULong64/);
  assert.match(implementation, /savePendingAcknowledgement/);
  assert.match(implementation, /clearPendingAcknowledgement/);
});

test("C4.1 command domain contains no network or relay access", async () => {
  const combined = [
    await source("GCCommandProtocol.cpp"),
    await source("GCCommandStateStore.cpp"),
  ].join("\n");

  assert.doesNotMatch(
    combined,
    /\b(HTTPClient|WiFiClient|GCRelayBoard|GCSafetyController)\b/,
  );
});
