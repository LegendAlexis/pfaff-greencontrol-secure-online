#pragma once

#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

#include "GCCommandProtocol.h"

enum class GCCommandPollOutcome : uint8_t {
  NotDue,
  Success,
  RetryScheduled,
  ConfigurationError
};

class GCCommandPollClient {
 public:
  void begin();
  void end();

  GCCommandPollOutcome poll(
    const GCCommandSequenceState& sequences,
    const GCAcknowledgement* acknowledgements,
    size_t acknowledgementCount,
    GCPollResponse& response
  );

  unsigned long nextPollAtMs() const;
  unsigned long currentBackoffMs() const;
  bool tlsReady() const;

 private:
  bool initializeTransport();
  bool validTlsConfiguration() const;
  void scheduleSuccess(unsigned long pollAfterMs);
  void scheduleRetry();
  void closeTransport();

  WiFiClientSecure secureClient_;
  HTTPClient http_;
  bool transportReady_ = false;
  bool tlsReady_ = false;
  unsigned long nextPollAtMs_ = 0;
  unsigned long backoffMs_ = 0;
};
