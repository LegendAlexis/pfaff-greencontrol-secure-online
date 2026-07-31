import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const current = new URL("../../firmware/current/", import.meta.url);

async function source(name: string) {
  return readFile(new URL(name, current), "utf8");
}

test("poll transport requires HTTPS and a verified root CA", async () => {
  const transport = await source("GCCommandPollClient.cpp");
  const example = await source("GCConfig.example.h");

  assert.match(transport, /secureClient_\.setCACert\(GC_TLS_ROOT_CA_PEM\)/);
  assert.match(transport, /url\.startsWith\("https:\/\/"\)/);
  assert.match(transport, /certificate\.indexOf\("REPLACE_"\) < 0/);
  assert.doesNotMatch(transport, /\.setInsecure\s*\(/);
  assert.match(example, /#define GC_TLS_ROOT_CA_PEM/);
  assert.match(example, /REPLACE_WITH_VERIFIED_ROOT_CA/);
});

test("poll transport uses C3 interval and bounded exponential backoff", async () => {
  const transport = await source("GCCommandPollClient.cpp");
  const example = await source("GCConfig.example.h");

  assert.match(example, /GC_COMMAND_POLL_INTERVAL_MS 1500UL/);
  assert.match(example, /GC_COMMAND_POLL_MAX_BACKOFF_MS 10000UL/);
  assert.match(transport, /backoffMs_ \* 2UL/);
  assert.match(transport, /GC_COMMAND_POLL_MAX_BACKOFF_MS/);
  assert.match(transport, /scheduleSuccess\(response\.pollAfterMs\)/);
});

test("poll transport sends device auth without logging credentials", async () => {
  const transport = await source("GCCommandPollClient.cpp");

  assert.match(transport, /"X-Device-Id", GC_DEVICE_ID/);
  assert.match(transport, /"X-Device-Secret", GC_DEVICE_SECRET/);
  assert.doesNotMatch(
    transport,
    /Serial\.(print|printf)[^\n]*(GC_DEVICE_ID|GC_DEVICE_SECRET)/,
  );
});

test("pending ACK ownership remains with caller until a successful poll", async () => {
  const transport = await source("GCCommandPollClient.cpp");

  assert.match(
    transport,
    /buildPollRequest\([\s\S]*?acknowledgements[\s\S]*?acknowledgementCount/,
  );
  assert.doesNotMatch(
    transport,
    /\b(clearPendingAcknowledgement|savePendingAcknowledgement)\b/,
  );
  assert.match(transport, /return GCCommandPollOutcome::Success/);
});

test("poll transport bounds blocking time and response size", async () => {
  const transport = await source("GCCommandPollClient.cpp");
  const example = await source("GCConfig.example.h");

  assert.match(example, /GC_COMMAND_POLL_CONNECT_TIMEOUT_MS 3000UL/);
  assert.match(example, /GC_COMMAND_POLL_REQUEST_TIMEOUT_MS 5000UL/);
  assert.match(transport, /MAX_RESPONSE_BYTES = 8192/);
  assert.match(transport, /http_\.setReuse\(true\)/);
});

test("C4.2 does not integrate the poll client into the firmware loop", async () => {
  const sketch = await source(
    "Pfaff_GreenControl_Firmware_v1_3_1_GPIO21_windows_off.ino",
  );

  assert.doesNotMatch(sketch, /GCCommandPollClient/);
  assert.match(sketch, /cloudClient\.sendHeartbeat/);
});
