#include "GCCommandOrchestrator.h"

#include "GCConfig.h"

#ifndef GC_COMMAND_DIAGNOSTICS
#define GC_COMMAND_DIAGNOSTICS 0
#endif

namespace {
constexpr GCCommandActuator ACTUATORS[] = {
  GCCommandActuator::Watering,
  GCCommandActuator::RoofWindow,
  GCCommandActuator::SideWindow
};
}

bool GCCommandOrchestrator::begin(GCRelayBoard& relayBoard) {
  ready_ = stateStore_.begin();
  if (!ready_) {
    Serial.println(
      "SICHERHEIT: Command-Verarbeitung ohne NVS deaktiviert."
    );
    return false;
  }

  wateringController_.begin(relayBoard, stateStore_);
  roofWindowController_.begin(relayBoard, stateStore_);
  sideWindowController_.begin(relayBoard, stateStore_);
  pollClient_.begin();
  if (GC_COMMAND_DIAGNOSTICS) {
    Serial.println("C5 COMMAND STATE READY");
  }
  return true;
}

void GCCommandOrchestrator::update(float temperatureC) {
  if (!ready_) return;

  wateringController_.setTemperature(temperatureC);
  if (
    static_cast<long>(millis() - pollClient_.nextPollAtMs()) < 0
  ) {
    return;
  }

  GCAcknowledgement sentAcknowledgements[GC_MAX_PENDING_ACKS];
  const size_t sentAcknowledgementCount = loadPendingAcknowledgements(
    sentAcknowledgements,
    GC_MAX_PENDING_ACKS
  );

  const GCCommandSequenceState sequences = stateStore_.loadSequences();
  GCPollResponse response;
  const GCCommandPollOutcome outcome = pollClient_.poll(
    sequences,
    sentAcknowledgements,
    sentAcknowledgementCount,
    response
  );
  if (outcome != GCCommandPollOutcome::Success) return;

  // HTTP 200 means C3 accepted the exact ACK snapshot sent in this request.
  // If local cleanup fails, stop here. Re-sending an identical final ACK is
  // idempotent, while processing a newer command could overwrite that ACK.
  if (
    !clearConfirmedAcknowledgements(
      sentAcknowledgements,
      sentAcknowledgementCount
    )
  ) {
    Serial.println("FEHLER: Bestaetigte Command-ACKs nicht geloescht.");
    return;
  }
  if (GC_COMMAND_DIAGNOSTICS && sentAcknowledgementCount > 0) {
    Serial.printf(
      "C5 ACK CONFIRMED count=%u\n",
      static_cast<unsigned int>(sentAcknowledgementCount)
    );
  }

  for (size_t index = 0; index < response.commandCount; ++index) {
    GCAcknowledgement acknowledgement;
    if (!dispatch(response.commands[index], acknowledgement)) {
      Serial.printf(
        "FEHLER: Command fuer %s nicht dauerhaft verarbeitet.\n",
        GCCommandProtocol::actuatorName(response.commands[index].actuator)
      );
    }
    else if (GC_COMMAND_DIAGNOSTICS) {
      Serial.printf(
        "C5 COMMAND STORED actuator=%s sequence=%llu status=%s\n",
        GCCommandProtocol::actuatorName(response.commands[index].actuator),
        response.commands[index].sequence,
        acknowledgement.status.c_str()
      );
    }
  }
}

size_t GCCommandOrchestrator::loadPendingAcknowledgements(
  GCAcknowledgement* acknowledgements,
  size_t capacity
) {
  if (acknowledgements == nullptr || capacity == 0) return 0;

  size_t count = 0;
  for (GCCommandActuator actuator : ACTUATORS) {
    if (count >= capacity) break;
    GCAcknowledgement acknowledgement;
    if (
      stateStore_.loadPendingAcknowledgement(
        actuator,
        acknowledgement
      )
    ) {
      acknowledgements[count++] = acknowledgement;
    }
  }
  return count;
}

bool GCCommandOrchestrator::clearConfirmedAcknowledgements(
  const GCAcknowledgement* acknowledgements,
  size_t acknowledgementCount
) {
  for (size_t index = 0; index < acknowledgementCount; ++index) {
    if (
      !stateStore_.clearPendingAcknowledgement(
        acknowledgements[index].actuator,
        acknowledgements[index].commandId
      )
    ) {
      return false;
    }
  }
  return true;
}

bool GCCommandOrchestrator::dispatch(
  const GCParsedCommand& command,
  GCAcknowledgement& acknowledgement
) {
  switch (command.actuator) {
    case GCCommandActuator::Watering:
      return wateringController_.process(command, acknowledgement);
    case GCCommandActuator::RoofWindow:
      return roofWindowController_.process(command, acknowledgement);
    case GCCommandActuator::SideWindow:
      return sideWindowController_.process(command, acknowledgement);
    default:
      return false;
  }
}
