import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMAND_POLL_AFTER_MS,
  MAX_ACKNOWLEDGEMENTS_PER_POLL,
  validateDeviceCommandPollRequest,
} from "../../lib/domain/device-command-poll.ts";

function validRequest() {
  return {
    protocol_version: 1,
    firmware_version: "1.3.1",
    last_applied_sequences: {
      watering: 3,
      roof_window: 0,
      side_window: 0,
    },
    acknowledgements: [],
  };
}

test("validates one complete poll request for all core actuators", () => {
  const result = validateDeviceCommandPollRequest(validRequest());

  assert.equal(result.ok, true);
  assert.deepEqual(result.request.lastAppliedSequences, {
    watering: 3,
    roof_window: 0,
    side_window: 0,
  });
  assert.equal(COMMAND_POLL_AFTER_MS, 1_500);
});

test("rejects missing, additional and invalid actuator sequences", () => {
  const invalid = [
    {
      ...validRequest(),
      last_applied_sequences: { watering: 0, roof_window: 0 },
    },
    {
      ...validRequest(),
      last_applied_sequences: {
        watering: 0,
        roof_window: 0,
        side_window: 0,
        heating: 0,
      },
    },
    {
      ...validRequest(),
      last_applied_sequences: {
        watering: -1,
        roof_window: 0,
        side_window: 0,
      },
    },
  ];

  for (const request of invalid) {
    assert.equal(validateDeviceCommandPollRequest(request).ok, false);
  }
});

test("rejects duplicate acknowledgements and oversized batches", () => {
  const acknowledgement = {
    command_id: "command-1",
    actuator: "watering",
    sequence: 1,
    status: "applied",
    actual_state: { state: "on" },
  };

  assert.equal(
    validateDeviceCommandPollRequest({
      ...validRequest(),
      acknowledgements: [acknowledgement, acknowledgement],
    }).ok,
    false,
  );
  assert.equal(
    validateDeviceCommandPollRequest({
      ...validRequest(),
      acknowledgements: Array.from(
        { length: MAX_ACKNOWLEDGEMENTS_PER_POLL + 1 },
        (_, index) => ({
          ...acknowledgement,
          command_id: `command-${index}`,
        }),
      ),
    }).ok,
    false,
  );
});

test("rejects unsupported protocol and oversized firmware version", () => {
  assert.equal(
    validateDeviceCommandPollRequest({
      ...validRequest(),
      protocol_version: 2,
    }).ok,
    false,
  );
  assert.equal(
    validateDeviceCommandPollRequest({
      ...validRequest(),
      firmware_version: "x".repeat(41),
    }).ok,
    false,
  );
});
