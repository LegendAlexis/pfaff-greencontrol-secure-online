#pragma once

#include "GCActuatorCommandGuard.h"
#include "GCRelayBoard.h"

class GCSideWindowCommandController {
 public:
  void begin(GCRelayBoard& relayBoard, GCCommandStateStore& stateStore);
  bool process(
    const GCParsedCommand& command,
    GCAcknowledgement& acknowledgement
  );
  bool emergencyStop();

 private:
  GCRelayBoard* relayBoard_ = nullptr;
  GCCommandStateStore* stateStore_ = nullptr;
};
