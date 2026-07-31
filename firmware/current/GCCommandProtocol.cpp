#include "GCCommandProtocol.h"

#include <ArduinoJson.h>

namespace {
constexpr unsigned long MIN_POLL_AFTER_MS = 500;
constexpr unsigned long MAX_POLL_AFTER_MS = 10000;

bool validIdentifier(const String& value) {
  if (value.isEmpty() || value.length() > 128) return false;

  for (size_t index = 0; index < value.length(); ++index) {
    const char character = value[index];
    if (
      !isAlphaNumeric(character) &&
      character != '.' &&
      character != '_' &&
      character != ':' &&
      character != '-'
    ) {
      return false;
    }
  }

  return true;
}

bool parseOperation(
  GCCommandActuator actuator,
  const String& commandName,
  JsonObjectConst payload,
  GCCommandOperation& operation
) {
  if (payload.isNull() || payload.size() != 1) return false;

  if (actuator == GCCommandActuator::Watering) {
    if (commandName != "set") return false;
    const String state = payload["state"] | "";
    if (state == "on") {
      operation = GCCommandOperation::WateringOn;
      return true;
    }
    if (state == "off") {
      operation = GCCommandOperation::WateringOff;
      return true;
    }
    return false;
  }

  if (
    actuator != GCCommandActuator::RoofWindow &&
    actuator != GCCommandActuator::SideWindow
  ) {
    return false;
  }

  if (commandName != "move") return false;
  const String action = payload["action"] | "";
  if (action == "open") {
    operation = GCCommandOperation::WindowOpen;
    return true;
  }
  if (action == "stop") {
    operation = GCCommandOperation::WindowStop;
    return true;
  }
  if (action == "close") {
    operation = GCCommandOperation::WindowClose;
    return true;
  }

  return false;
}

bool appendAcknowledgement(
  JsonArray acknowledgements,
  const GCAcknowledgement& acknowledgement
) {
  if (
    !acknowledgement.pending ||
    !validIdentifier(acknowledgement.commandId) ||
    acknowledgement.actuator == GCCommandActuator::Invalid ||
    acknowledgement.sequence == 0 ||
    acknowledgement.status.isEmpty()
  ) {
    return false;
  }

  JsonObject item = acknowledgements.add<JsonObject>();
  item["command_id"] = acknowledgement.commandId;
  item["actuator"] =
    GCCommandProtocol::actuatorName(acknowledgement.actuator);
  item["sequence"] = acknowledgement.sequence;
  item["status"] = acknowledgement.status;
  if (!acknowledgement.reason.isEmpty()) {
    item["reason"] = acknowledgement.reason;
  }

  JsonObject actualState = item["actual_state"].to<JsonObject>();
  if (acknowledgement.actuator == GCCommandActuator::Watering) {
    if (
      acknowledgement.wateringState != "on" &&
      acknowledgement.wateringState != "off"
    ) {
      return false;
    }
    actualState["state"] = acknowledgement.wateringState;
    return true;
  }

  if (
    acknowledgement.windowPosition.isEmpty() ||
    acknowledgement.windowMovement.isEmpty()
  ) {
    return false;
  }
  actualState["position"] = acknowledgement.windowPosition;
  actualState["movement"] = acknowledgement.windowMovement;
  return true;
}
}

uint64_t GCCommandSequenceState::get(
  GCCommandActuator actuator
) const {
  switch (actuator) {
    case GCCommandActuator::Watering:
      return watering;
    case GCCommandActuator::RoofWindow:
      return roofWindow;
    case GCCommandActuator::SideWindow:
      return sideWindow;
    default:
      return 0;
  }
}

void GCCommandSequenceState::set(
  GCCommandActuator actuator,
  uint64_t sequence
) {
  switch (actuator) {
    case GCCommandActuator::Watering:
      watering = sequence;
      break;
    case GCCommandActuator::RoofWindow:
      roofWindow = sequence;
      break;
    case GCCommandActuator::SideWindow:
      sideWindow = sequence;
      break;
    default:
      break;
  }
}

bool GCCommandProtocol::parsePollResponse(
  const String& json,
  GCPollResponse& response
) {
  response = GCPollResponse{};

  JsonDocument document;
  const DeserializationError error = deserializeJson(document, json);
  if (error) return false;
  if (document["ok"] != true) return false;
  if (document["protocol_version"] != GC_COMMAND_PROTOCOL_VERSION) {
    return false;
  }

  const unsigned long pollAfterMs =
    document["poll_after_ms"] | 0UL;
  if (
    pollAfterMs < MIN_POLL_AFTER_MS ||
    pollAfterMs > MAX_POLL_AFTER_MS
  ) {
    return false;
  }

  const String serverTime = document["server_time"] | "";
  if (serverTime.isEmpty()) return false;

  JsonArrayConst commands = document["commands"].as<JsonArrayConst>();
  if (commands.isNull() || commands.size() > GC_MAX_POLL_COMMANDS) {
    return false;
  }

  bool actuatorSeen[3] = {false, false, false};
  size_t commandCount = 0;

  for (JsonObjectConst item : commands) {
    GCParsedCommand command;
    command.id = item["id"] | "";
    command.actuator = parseActuator(item["actuator"] | "");
    command.sequence = item["sequence"] | 0ULL;
    command.createdAt = item["created_at"] | "";
    command.expiresAt = item["expires_at"] | "";

    if (
      !validIdentifier(command.id) ||
      command.actuator == GCCommandActuator::Invalid ||
      command.sequence == 0 ||
      command.createdAt.isEmpty() ||
      command.expiresAt.isEmpty()
    ) {
      return false;
    }

    const size_t actuatorIndex =
      static_cast<size_t>(command.actuator);
    if (actuatorIndex >= 3 || actuatorSeen[actuatorIndex]) {
      return false;
    }
    actuatorSeen[actuatorIndex] = true;

    const String commandName = item["command"] | "";
    if (
      !parseOperation(
        command.actuator,
        commandName,
        item["payload"].as<JsonObjectConst>(),
        command.operation
      )
    ) {
      return false;
    }

    response.commands[commandCount++] = command;
  }

  response.valid = true;
  response.pollAfterMs = pollAfterMs;
  response.serverTime = serverTime;
  response.commandCount = commandCount;
  return true;
}

bool GCCommandProtocol::buildPollRequest(
  const String& firmwareVersion,
  const GCCommandSequenceState& sequences,
  const GCAcknowledgement* acknowledgements,
  size_t acknowledgementCount,
  String& json
) {
  json = "";
  if (
    firmwareVersion.isEmpty() ||
    firmwareVersion.length() > 40 ||
    acknowledgementCount > GC_MAX_PENDING_ACKS ||
    (acknowledgementCount > 0 && acknowledgements == nullptr)
  ) {
    return false;
  }

  JsonDocument document;
  document["protocol_version"] = GC_COMMAND_PROTOCOL_VERSION;
  document["firmware_version"] = firmwareVersion;

  JsonObject sequenceState =
    document["last_applied_sequences"].to<JsonObject>();
  sequenceState["watering"] = sequences.watering;
  sequenceState["roof_window"] = sequences.roofWindow;
  sequenceState["side_window"] = sequences.sideWindow;

  JsonArray acknowledgementArray =
    document["acknowledgements"].to<JsonArray>();
  for (size_t index = 0; index < acknowledgementCount; ++index) {
    if (
      !appendAcknowledgement(
        acknowledgementArray,
        acknowledgements[index]
      )
    ) {
      json = "";
      return false;
    }
  }

  serializeJson(document, json);
  return !json.isEmpty();
}

const char* GCCommandProtocol::actuatorName(
  GCCommandActuator actuator
) {
  switch (actuator) {
    case GCCommandActuator::Watering:
      return "watering";
    case GCCommandActuator::RoofWindow:
      return "roof_window";
    case GCCommandActuator::SideWindow:
      return "side_window";
    default:
      return "invalid";
  }
}

GCCommandActuator GCCommandProtocol::parseActuator(
  const String& value
) {
  if (value == "watering") return GCCommandActuator::Watering;
  if (value == "roof_window") return GCCommandActuator::RoofWindow;
  if (value == "side_window") return GCCommandActuator::SideWindow;
  return GCCommandActuator::Invalid;
}
