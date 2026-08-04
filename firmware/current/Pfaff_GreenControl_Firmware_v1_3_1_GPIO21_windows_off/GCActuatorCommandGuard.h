#pragma once

#include <Arduino.h>

#include "GCCommandProtocol.h"
#include "GCCommandStateStore.h"

enum class GCCommandGuardDecision : uint8_t {
  Apply,
  ReusePendingAcknowledgement,
  AlreadyApplied,
  Superseded,
  Invalid
};

class GCActuatorCommandGuard {
 public:
  static GCCommandGuardDecision evaluate(
    const GCParsedCommand& command,
    GCCommandActuator expectedActuator,
    GCCommandStateStore& stateStore,
    GCAcknowledgement& acknowledgement
  );

  static bool persistDecision(
    GCCommandStateStore& stateStore,
    const GCParsedCommand& command,
    GCAcknowledgement& acknowledgement,
    const char* status,
    const char* reason = nullptr
  );

  static void setWateringState(
    GCAcknowledgement& acknowledgement,
    bool on
  );
  static void setDisabledWindowState(
    GCAcknowledgement& acknowledgement
  );

 private:
  static bool structurallyValid(
    const GCParsedCommand& command,
    GCCommandActuator expectedActuator
  );
};
