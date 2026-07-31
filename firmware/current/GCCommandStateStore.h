#pragma once

#include <Arduino.h>
#include <Preferences.h>

#include "GCCommandProtocol.h"

class GCCommandStateStore {
 public:
  bool begin();
  void end();

  GCCommandSequenceState loadSequences();
  bool saveSequence(
    GCCommandActuator actuator,
    uint64_t sequence
  );

  bool loadPendingAcknowledgement(
    GCCommandActuator actuator,
    GCAcknowledgement& acknowledgement
  );
  bool savePendingAcknowledgement(
    const GCAcknowledgement& acknowledgement
  );
  bool clearPendingAcknowledgement(
    GCCommandActuator actuator,
    const String& commandId
  );

 private:
  const char* sequenceKey(GCCommandActuator actuator) const;
  const char* acknowledgementKey(GCCommandActuator actuator) const;

  Preferences preferences_;
  bool available_ = false;
};
