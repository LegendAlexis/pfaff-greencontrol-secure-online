#include "GCCloudClient.h"

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

#include "GCConfig.h"

namespace {
bool readNullableBool(
  JsonVariantConst value,
  bool& hasValue,
  bool& result
) {
  if (value.isNull()) {
    hasValue = false;
    return true;
  }
  if (!value.is<bool>()) return false;
  hasValue = true;
  result = value.as<bool>();
  return true;
}

bool validTlsConfiguration() {
  const String certificate = GC_TLS_ROOT_CA_PEM;
  const String url = GC_API_URL;
  return (
    url.startsWith("https://") &&
    certificate.indexOf("-----BEGIN CERTIFICATE-----") >= 0 &&
    certificate.indexOf("-----END CERTIFICATE-----") >= 0 &&
    certificate.indexOf("REPLACE_") < 0
  );
}
}

bool GCCloudClient::parseResponse(
  const String& response,
  GCCloudCommands& commands
) {
  JsonDocument document;
  const DeserializationError error = deserializeJson(document, response);
  if (error) {
    Serial.printf("JSON-Fehler: %s\n", error.c_str());
    return false;
  }
  if (document["ok"] != true) return false;

  commands = GCCloudCommands{};
  commands.valid = true;
  JsonObjectConst values = document["commands"].as<JsonObjectConst>();
  if (!values.isNull()) {
    if (
      !readNullableBool(
        values["roof_window_target"],
        commands.hasRoofTarget,
        commands.roofTargetOpen
      ) ||
      !readNullableBool(
        values["wall_window_target"],
        commands.hasWallTarget,
        commands.wallTargetOpen
      ) ||
      !readNullableBool(
        values["watering_target"],
        commands.hasWateringTarget,
        commands.wateringTargetOn
      ) ||
      !readNullableBool(
        values["heating_target"],
        commands.hasHeatingTarget,
        commands.heatingTargetOn
      )
    ) {
      return false;
    }
  }
  return true;
}

bool GCCloudClient::sendHeartbeat(
  const GCDeviceState& state,
  GCCloudCommands& commands
) {
  if (!validTlsConfiguration()) {
    Serial.println(
      "SICHERHEIT: Heartbeat TLS-Root-CA fehlt oder ist Platzhalter."
    );
    return false;
  }

  WiFiClientSecure client;
  client.setCACert(GC_TLS_ROOT_CA_PEM);
  HTTPClient http;
  http.setConnectTimeout(10000);
  http.setTimeout(15000);
  if (!http.begin(client, GC_API_URL)) return false;

  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-id", GC_DEVICE_ID);
  http.addHeader("x-device-secret", GC_DEVICE_SECRET);

  JsonDocument payload;
  payload["status"] = "online";
  payload["firmware_version"] = GC_FIRMWARE_VERSION;
  if (isnan(state.temperatureC)) {
    payload["temperature"] = nullptr;
  } else {
    payload["temperature"] = state.temperatureC;
  }
  payload["roof_window_open"] = state.roofOpen;
  payload["wall_window_open"] = state.wallOpen;
  payload["watering_on"] = state.wateringOn;
  payload["heating_on"] = state.heatingOn;
  payload["pressure_ok"] = state.pressureOk;
  payload["wifi_rssi"] = state.wifiRssi;
  payload["uptime_seconds"] = state.uptimeSeconds;

  String body;
  serializeJson(payload, body);
  Serial.println("\nSende Heartbeat ...");
  const int statusCode = http.POST(body);
  const String response = http.getString();
  Serial.printf("HTTP-Status: %d\n", statusCode);
  Serial.println(response);
  http.end();
  if (statusCode != HTTP_CODE_OK) return false;

  const bool parsed = parseResponse(response, commands);
  if (parsed) {
    Serial.printf(
      "Befehle: Dach=%s Wand=%s Wasser=%s Heizung=%s\n",
      commands.hasRoofTarget
        ? (commands.roofTargetOpen ? "AUF" : "ZU")
        : "-",
      commands.hasWallTarget
        ? (commands.wallTargetOpen ? "AUF" : "ZU")
        : "-",
      commands.hasWateringTarget
        ? (commands.wateringTargetOn ? "EIN" : "AUS")
        : "-",
      commands.hasHeatingTarget
        ? (commands.heatingTargetOn ? "EIN" : "AUS")
        : "-"
    );
    Serial.println("Heartbeat erfolgreich.");
  }
  return parsed;
}
