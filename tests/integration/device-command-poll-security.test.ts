import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeUrl = new URL(
  "../../app/api/device/commands/poll/route.ts",
  import.meta.url,
);
const heartbeatUrl = new URL(
  "../../app/api/device/heartbeat/route.ts",
  import.meta.url,
);

test("poll route binds every command mutation to the authenticated device", async () => {
  const route = await readFile(routeUrl, "utf8");

  assert.match(route, /\.eq\("device_id", deviceId\)/);
  assert.match(route, /\.eq\("id", acknowledgement\.command_id\)/);
  assert.match(route, /\.eq\("actuator", acknowledgement\.actuator\)/);
  assert.match(route, /\.eq\("sequence", acknowledgement\.sequence\)/);
  assert.match(
    route,
    /\.in\("status", \[\s*"pending",\s*"delivered",\s*acknowledgement\.status/,
  );
  assert.match(route, /\.eq\("id", commandId\)/);
});

test("poll route cannot rewrite a conflicting final acknowledgement", async () => {
  const route = await readFile(routeUrl, "utf8");

  assert.match(route, /statusIsOpen/);
  assert.match(
    route,
    /statusIsOpen \|\| command\.status === acknowledgement\.status/,
  );
});

test("poll route uses existing device authentication and no-store responses", async () => {
  const route = await readFile(routeUrl, "utf8");

  assert.match(route, /readDeviceCredentials\(request\.headers\)/);
  assert.match(route, /select\("id,active,secret_hash"\)/);
  assert.match(route, /"Cache-Control": "no-store"/);
  assert.doesNotMatch(route, /device[_-]?secret.*console/i);
});

test("C3 leaves the existing heartbeat implementation unchanged", async () => {
  const heartbeat = await readFile(heartbeatUrl, "utf8");

  assert.match(heartbeat, /export async function POST/);
  assert.match(heartbeat, /createHeartbeatPersistence/);
  assert.match(heartbeat, /commands:\s*\{/);
  assert.match(heartbeat, /watering_target: effectiveWateringTarget/);
});
