#include "GCCommandStateStore.h"

#include <ArduinoJson.h>

namespace {
constexpr const char* NAMESPACE = "gc_commands";
}

bool GCCommandStateStore::begin() {
  available_ = preferences_.begin(NAMESPACE, false);
  if (!available_) {
    Serial.println("FEHLER: Command-NVS nicht verfuegbar.");
  }
  return available_;
}

void GCCommandStateStore::end() {
  if (available_) preferences_.end();
  available_ = false;
}

GCCommandSequenceState GCCommandStateStore::loadSequences() {
  GCCommandSequenceState sequences;
  if (!available_) return sequences;

  sequences.watering =
    preferences_.getULong64(sequenceKey(GCCommandActuator::Watering), 0);
  sequences.roofWindow =
    preferences_.getULong64(sequenceKey(GCCommandActuator::RoofWindow), 0);
  sequences.sideWindow =
    preferences_.getULong64(sequenceKey(GCCommandActuator::SideWindow), 0);
  return sequences;
}

bool GCCommandStateStore::saveSequence(
  GCCommandActuator actuator,
  uint64_t sequence
) {
  if (!available_ || sequence == 0) return false;
  const char* key = sequenceKey(actuator);
  if (key == nullptr) return false;

  const uint64_t current = preferences_.getULong64(key, 0);
  if (sequence < current) return false;
  if (sequence == current) return true;
  return preferences_.putULong64(key, sequence) == sizeof(uint64_t);
}

bool GCCommandStateStore::loadPendingAcknowledgement(
  GCCommandActuator actuator,
  GCAcknowledgement& acknowledgement
) {
  acknowledgement = GCAcknowledgement{};
  if (!available_) return false;
  const char* key = acknowledgementKey(actuator);
  if (key == nullptr) return false;

  const String json = preferences_.getString(key, "");
  if (json.isEmpty()) return false;

  JsonDocument document;
  if (deserializeJson(document, json)) return false;

  acknowledgement.pending = true;
  acknowledgement.commandId = document["command_id"] | "";
  acknowledgement.actuator = actuator;
  acknowledgement.sequence = document["sequence"] | 0ULL;
  acknowledgement.status = document["status"] | "";
  acknowledgement.reason = document["reason"] | "";
  acknowledgement.wateringState =
    document["watering_state"] | "";
  acknowledgement.windowPosition =
    document["window_position"] | "";
  acknowledgement.windowMovement =
    document["window_movement"] | "";

  return (
    !acknowledgement.commandId.isEmpty() &&
    acknowledgement.sequence > 0 &&
    !acknowledgement.status.isEmpty()
  );
}

bool GCCommandStateStore::savePendingAcknowledgement(
  const GCAcknowledgement& acknowledgement
) {
  if (
    !available_ ||
    !acknowledgement.pending ||
    acknowledgement.commandId.isEmpty() ||
    acknowledgement.sequence == 0
  ) {
    return false;
  }

  const char* key = acknowledgementKey(acknowledgement.actuator);
  if (key == nullptr) return false;

  JsonDocument document;
  document["command_id"] = acknowledgement.commandId;
  document["sequence"] = acknowledgement.sequence;
  document["status"] = acknowledgement.status;
  if (!acknowledgement.reason.isEmpty()) {
    document["reason"] = acknowledgement.reason;
  }
  if (!acknowledgement.wateringState.isEmpty()) {
    document["watering_state"] = acknowledgement.wateringState;
  }
  if (!acknowledgement.windowPosition.isEmpty()) {
    document["window_position"] = acknowledgement.windowPosition;
  }
  if (!acknowledgement.windowMovement.isEmpty()) {
    document["window_movement"] = acknowledgement.windowMovement;
  }

  String json;
  serializeJson(document, json);
  return preferences_.putString(key, json) == json.length();
}

bool GCCommandStateStore::clearPendingAcknowledgement(
  GCCommandActuator actuator,
  const String& commandId
) {
  if (!available_ || commandId.isEmpty()) return false;

  GCAcknowledgement stored;
  if (!loadPendingAcknowledgement(actuator, stored)) return true;
  if (stored.commandId != commandId) return false;

  return preferences_.remove(acknowledgementKey(actuator));
}

const char* GCCommandStateStore::sequenceKey(
  GCCommandActuator actuator
) const {
  switch (actuator) {
    case GCCommandActuator::Watering:
      return "seq_water";
    case GCCommandActuator::RoofWindow:
      return "seq_roof";
    case GCCommandActuator::SideWindow:
      return "seq_side";
    default:
      return nullptr;
  }
}

const char* GCCommandStateStore::acknowledgementKey(
  GCCommandActuator actuator
) const {
  switch (actuator) {
    case GCCommandActuator::Watering:
      return "ack_water";
    case GCCommandActuator::RoofWindow:
      return "ack_roof";
    case GCCommandActuator::SideWindow:
      return "ack_side";
    default:
      return nullptr;
  }
}
