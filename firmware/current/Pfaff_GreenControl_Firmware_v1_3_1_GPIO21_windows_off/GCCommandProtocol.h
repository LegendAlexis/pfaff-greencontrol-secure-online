#pragma once

#include <Arduino.h>

constexpr uint8_t GC_COMMAND_PROTOCOL_VERSION = 1;
constexpr size_t GC_MAX_POLL_COMMANDS = 3;
constexpr size_t GC_MAX_PENDING_ACKS = 3;

enum class GCCommandActuator : uint8_t {
  Watering = 0,
  RoofWindow = 1,
  SideWindow = 2,
  Invalid = 255
};

enum class GCCommandOperation : uint8_t {
  WateringOn,
  WateringOff,
  WindowOpen,
  WindowStop,
  WindowClose,
  Invalid
};

struct GCCommandSequenceState {
  uint64_t watering = 0;
  uint64_t roofWindow = 0;
  uint64_t sideWindow = 0;

  uint64_t get(GCCommandActuator actuator) const;
  void set(GCCommandActuator actuator, uint64_t sequence);
};

struct GCParsedCommand {
  String id;
  GCCommandActuator actuator = GCCommandActuator::Invalid;
  GCCommandOperation operation = GCCommandOperation::Invalid;
  uint64_t sequence = 0;
  String createdAt;
  String expiresAt;
};

struct GCAcknowledgement {
  bool pending = false;
  String commandId;
  GCCommandActuator actuator = GCCommandActuator::Invalid;
  uint64_t sequence = 0;
  String status;
  String reason;
  String wateringState;
  String windowPosition;
  String windowMovement;
};

struct GCPollResponse {
  bool valid = false;
  unsigned long pollAfterMs = 1500;
  String serverTime;
  GCParsedCommand commands[GC_MAX_POLL_COMMANDS];
  size_t commandCount = 0;
};

class GCCommandProtocol {
 public:
  static bool parsePollResponse(
    const String& json,
    GCPollResponse& response
  );

  static bool buildPollRequest(
    const String& firmwareVersion,
    const GCCommandSequenceState& sequences,
    const GCAcknowledgement* acknowledgements,
    size_t acknowledgementCount,
    String& json
  );

  static const char* actuatorName(GCCommandActuator actuator);
  static GCCommandActuator parseActuator(const String& value);
};
