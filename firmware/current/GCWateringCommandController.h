#pragma once

#include <Arduino.h>

#include "GCActuatorCommandGuard.h"
#include "GCRelayBoard.h"

class GCWateringCommandController {
 public:
  void begin(GCRelayBoard& relayBoard, GCCommandStateStore& stateStore);
  void setTemperature(float temperatureC, unsigned long measuredAtMs);
  bool process(
    const GCParsedCommand& command,
    GCAcknowledgement& acknowledgement
  );

 private:
  bool persistWithoutAction(
    const GCParsedCommand& command,
    GCCommandGuardDecision decision,
    GCAcknowledgement& acknowledgement
  );

  GCRelayBoard* relayBoard_ = nullptr;
  GCCommandStateStore* stateStore_ = nullptr;
  float temperatureC_ = NAN;
  unsigned long temperatureMeasuredAtMs_ = 0;
};
