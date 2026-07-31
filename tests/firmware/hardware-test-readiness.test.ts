import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const current = new URL("../../firmware/current/", import.meta.url);

async function source(name: string) {
  return readFile(new URL(name, current), "utf8");
}

test("C5 diagnostics are opt-in and never print device credentials", async () => {
  const config = await source("GCConfig.example.h");
  const implementation = [
    await source("GCCommandPollClient.cpp"),
    await source("GCCommandOrchestrator.cpp"),
  ].join("\n");

  assert.match(config, /#define GC_COMMAND_DIAGNOSTICS 0/);
  assert.match(implementation, /if \(GC_COMMAND_DIAGNOSTICS/);
  assert.match(implementation, /C5 TLS CONFIG READY/);
  assert.match(implementation, /C5 POLL OK/);
  assert.match(implementation, /C5 ACK CONFIRMED/);
  assert.match(implementation, /C5 COMMAND STORED/);
  assert.doesNotMatch(
    implementation,
    /Serial\.(?:print|printf)[^\n]*(?:GC_DEVICE_SECRET|GC_DEVICE_ID)/,
  );
});

test("hardware-test diagnostics do not weaken TLS or window locks", async () => {
  const poll = await source("GCCommandPollClient.cpp");
  const relay = await source("GCRelayBoard.cpp");

  assert.doesNotMatch(poll, /setInsecure\s*\(/);
  assert.match(poll, /setCACert\(GC_TLS_ROOT_CA_PEM\)/);
  assert.match(relay, /channel == GC_RELAY_ROOF_OPEN/);
  assert.match(relay, /channel == GC_RELAY_WALL_CLOSE/);
  assert.match(relay, /if \(on && !permitted\(channel\)\)/);
});
