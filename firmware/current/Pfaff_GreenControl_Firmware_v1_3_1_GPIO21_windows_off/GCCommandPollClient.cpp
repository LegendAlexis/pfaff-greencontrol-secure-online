#include "GCCommandPollClient.h"

#include <WiFi.h>

#include "GCConfig.h"

#ifndef GC_COMMAND_DIAGNOSTICS
#define GC_COMMAND_DIAGNOSTICS 0
#endif

namespace {
constexpr size_t MAX_RESPONSE_BYTES = 8192;

bool timeReached(unsigned long now, unsigned long deadline) {
  return static_cast<long>(now - deadline) >= 0;
}
}

void GCCommandPollClient::begin() {
  nextPollAtMs_ = millis();
  backoffMs_ = GC_COMMAND_POLL_INTERVAL_MS;
  tlsReady_ = validTlsConfiguration();

  if (!tlsReady_) {
    Serial.println(
      "SICHERHEIT: Command-Poll TLS-Root-CA fehlt oder ist Platzhalter."
    );
  }
  else if (GC_COMMAND_DIAGNOSTICS) {
    Serial.println("C5 TLS CONFIG READY");
  }
}

void GCCommandPollClient::end() {
  closeTransport();
  tlsReady_ = false;
}

GCCommandPollOutcome GCCommandPollClient::poll(
  const GCCommandSequenceState& sequences,
  const GCAcknowledgement* acknowledgements,
  size_t acknowledgementCount,
  GCPollResponse& response
) {
  response = GCPollResponse{};
  const unsigned long now = millis();

  if (!timeReached(now, nextPollAtMs_)) {
    return GCCommandPollOutcome::NotDue;
  }

  if (!tlsReady_) {
    scheduleRetry();
    return GCCommandPollOutcome::ConfigurationError;
  }

  if (WiFi.status() != WL_CONNECTED) {
    scheduleRetry();
    return GCCommandPollOutcome::RetryScheduled;
  }

  String requestBody;
  if (
    !GCCommandProtocol::buildPollRequest(
      GC_FIRMWARE_VERSION,
      sequences,
      acknowledgements,
      acknowledgementCount,
      requestBody
    )
  ) {
    Serial.println("FEHLER: Command-Poll Request ungueltig.");
    scheduleRetry();
    return GCCommandPollOutcome::ConfigurationError;
  }

  if (!initializeTransport()) {
    scheduleRetry();
    return GCCommandPollOutcome::RetryScheduled;
  }

  const int statusCode = http_.POST(requestBody);
  if (statusCode != HTTP_CODE_OK) {
    Serial.printf("Command-Poll HTTP-Status: %d\n", statusCode);
    closeTransport();
    scheduleRetry();
    return GCCommandPollOutcome::RetryScheduled;
  }

  const int responseSize = http_.getSize();
  if (
    responseSize > static_cast<int>(MAX_RESPONSE_BYTES)
  ) {
    Serial.println("FEHLER: Command-Poll Antwort zu gross.");
    closeTransport();
    scheduleRetry();
    return GCCommandPollOutcome::RetryScheduled;
  }

  const String responseBody = http_.getString();
  if (
    responseBody.length() > MAX_RESPONSE_BYTES ||
    !GCCommandProtocol::parsePollResponse(responseBody, response)
  ) {
    Serial.println("FEHLER: Command-Poll Antwort ungueltig.");
    closeTransport();
    scheduleRetry();
    return GCCommandPollOutcome::RetryScheduled;
  }

  scheduleSuccess(response.pollAfterMs);
  if (GC_COMMAND_DIAGNOSTICS) {
    Serial.printf(
      "C5 POLL OK ack_sent=%u commands=%u next_ms=%lu\n",
      static_cast<unsigned int>(acknowledgementCount),
      static_cast<unsigned int>(response.commandCount),
      response.pollAfterMs
    );
  }
  return GCCommandPollOutcome::Success;
}

unsigned long GCCommandPollClient::nextPollAtMs() const {
  return nextPollAtMs_;
}

unsigned long GCCommandPollClient::currentBackoffMs() const {
  return backoffMs_;
}

bool GCCommandPollClient::tlsReady() const {
  return tlsReady_;
}

bool GCCommandPollClient::initializeTransport() {
  if (transportReady_) return true;

  secureClient_.setCACert(GC_TLS_ROOT_CA_PEM);
  http_.setConnectTimeout(GC_COMMAND_POLL_CONNECT_TIMEOUT_MS);
  http_.setTimeout(GC_COMMAND_POLL_REQUEST_TIMEOUT_MS);
  http_.setReuse(true);

  if (!http_.begin(secureClient_, GC_COMMAND_POLL_URL)) {
    Serial.println("FEHLER: Command-Poll HTTPS konnte nicht starten.");
    closeTransport();
    return false;
  }

  http_.addHeader("Content-Type", "application/json");
  http_.addHeader("X-Device-Id", GC_DEVICE_ID);
  http_.addHeader("X-Device-Secret", GC_DEVICE_SECRET);
  transportReady_ = true;
  return true;
}

bool GCCommandPollClient::validTlsConfiguration() const {
  const String certificate = GC_TLS_ROOT_CA_PEM;
  const String url = GC_COMMAND_POLL_URL;

  return (
    url.startsWith("https://") &&
    certificate.indexOf("-----BEGIN CERTIFICATE-----") >= 0 &&
    certificate.indexOf("-----END CERTIFICATE-----") >= 0 &&
    certificate.indexOf("REPLACE_") < 0
  );
}

void GCCommandPollClient::scheduleSuccess(
  unsigned long pollAfterMs
) {
  backoffMs_ = GC_COMMAND_POLL_INTERVAL_MS;
  nextPollAtMs_ = millis() + pollAfterMs;
}

void GCCommandPollClient::scheduleRetry() {
  if (backoffMs_ < GC_COMMAND_POLL_INTERVAL_MS) {
    backoffMs_ = GC_COMMAND_POLL_INTERVAL_MS;
  }

  nextPollAtMs_ = millis() + backoffMs_;

  if (backoffMs_ < GC_COMMAND_POLL_MAX_BACKOFF_MS) {
    const unsigned long doubled = backoffMs_ * 2UL;
    backoffMs_ = min(
      doubled,
      static_cast<unsigned long>(GC_COMMAND_POLL_MAX_BACKOFF_MS)
    );
  }
}

void GCCommandPollClient::closeTransport() {
  if (transportReady_) http_.end();
  secureClient_.stop();
  transportReady_ = false;
}
