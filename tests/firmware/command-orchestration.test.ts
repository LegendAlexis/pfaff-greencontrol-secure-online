import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const current = new URL("../../firmware/current/", import.meta.url);

async function source(name: string) {
  return readFile(new URL(name, current), "utf8");
}

test("loop integrates the orchestrator beside the unchanged heartbeat", async () => {
  const sketch = await source(
    "Pfaff_GreenControl_Firmware_v1_3_1_GPIO21_windows_off.ino",
  );

  assert.match(sketch, /GCCommandOrchestrator commandOrchestrator/);
  assert.match(sketch, /commandOrchestrator\.begin\(relayBoard\)/);
  assert.match(
    sketch,
    /commandOrchestrator\.update\(lastTemperatureC, lastTemperatureReadMs\)/,
  );
  assert.match(sketch, /cloudClient\.sendHeartbeat/);
  assert.match(sketch, /GC_HEARTBEAT_INTERVAL_MS/);
});

test("pending ACKs are loaded before every poll", async () => {
  const orchestration = await source("GCCommandOrchestrator.cpp");

  const dueCheck = orchestration.indexOf("pollClient_.nextPollAtMs()");
  const loadCall = orchestration.indexOf("loadPendingAcknowledgements(");
  assert.ok(dueCheck >= 0);
  assert.ok(loadCall > dueCheck);
  assert.match(orchestration, /loadPendingAcknowledgements/);
  assert.match(orchestration, /GC_MAX_PENDING_ACKS/);
  assert.match(orchestration, /stateStore_\.loadPendingAcknowledgement/);
  assert.match(
    orchestration,
    /pollClient_\.poll\([\s\S]*sentAcknowledgements[\s\S]*sentAcknowledgementCount/,
  );
});

test("non-due loop iterations return before reading command NVS", async () => {
  const orchestration = await source("GCCommandOrchestrator.cpp");

  assert.match(
    orchestration,
    /millis\(\) - pollClient_\.nextPollAtMs\(\)[\s\S]*?return;[\s\S]*?loadPendingAcknowledgements/,
  );
});

test("ACKs are cleared only after a successful poll", async () => {
  const orchestration = await source("GCCommandOrchestrator.cpp");
  const successCheck = orchestration.indexOf(
    "outcome != GCCommandPollOutcome::Success",
  );
  const clearCall = orchestration.indexOf("clearConfirmedAcknowledgements(");
  const dispatchLoop = orchestration.indexOf(
    "index < response.commandCount",
  );

  assert.ok(successCheck >= 0);
  assert.ok(clearCall > successCheck);
  assert.ok(dispatchLoop > clearCall);
  assert.match(orchestration, /clearPendingAcknowledgement/);
});

test("failed ACK cleanup prevents newer command processing", async () => {
  const orchestration = await source("GCCommandOrchestrator.cpp");

  assert.match(
    orchestration,
    /!clearConfirmedAcknowledgements\([\s\S]*?return;[\s\S]*?response\.commandCount/,
  );
});

test("commands are dispatched to exactly one actuator controller", async () => {
  const orchestration = await source("GCCommandOrchestrator.cpp");

  assert.match(orchestration, /case GCCommandActuator::Watering/);
  assert.match(orchestration, /wateringController_\.process/);
  assert.match(orchestration, /case GCCommandActuator::RoofWindow/);
  assert.match(orchestration, /roofWindowController_\.process/);
  assert.match(orchestration, /case GCCommandActuator::SideWindow/);
  assert.match(orchestration, /sideWindowController_\.process/);
});

test("orchestrator fails closed when durable NVS is unavailable", async () => {
  const orchestration = await source("GCCommandOrchestrator.cpp");

  assert.match(orchestration, /ready_ = stateStore_\.begin\(\)/);
  assert.match(orchestration, /if \(!ready_\)/);
  assert.match(orchestration, /if \(!ready_\) return/);
});
