#pragma once

#include <Arduino.h>

#include "GCCommandPollClient.h"
#include "GCCommandStateStore.h"
#include "GCRoofWindowCommandController.h"
#include "GCSideWindowCommandController.h"
#include "GCWateringCommandController.h"

class GCCommandOrchestrator {
 public:
  bool begin(GCRelayBoard& relayBoard);
  void update(float temperatureC);

 private:
  size_t loadPendingAcknowledgements(
    GCAcknowledgement* acknowledgements,
    size_t capacity
  );
  bool clearConfirmedAcknowledgements(
    const GCAcknowledgement* acknowledgements,
    size_t acknowledgementCount
  );
  bool dispatch(
    const GCParsedCommand& command,
    GCAcknowledgement& acknowledgement
  );

  GCCommandStateStore stateStore_;
  GCCommandPollClient pollClient_;
  GCWateringCommandController wateringController_;
  GCRoofWindowCommandController roofWindowController_;
  GCSideWindowCommandController sideWindowController_;
  bool ready_ = false;
};
