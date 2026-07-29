#include <Arduino.h>
#include "GCConfig.h"
#include "GCWifiService.h"
#include "GCTemperatureService.h"
#include "GCRelayBoard.h"
#include "GCInputService.h"
#include "GCCloudClient.h"
#include "GCSafetyController.h"

GCWifiService wifiService;
GCTemperatureService temperatureService;
GCRelayBoard relayBoard;
GCInputService inputService;
GCCloudClient cloudClient;
GCSafetyController safetyController;

unsigned long lastTemperatureReadMs = 0;
unsigned long lastHeartbeatMs = 0;
float lastTemperatureC = NAN;

void setup() {
  Serial.begin(115200);
  delay(1200);
  Serial.println();
  Serial.println("================================================");
  Serial.println("Pfaff GreenControl Firmware v1.2.0");
  Serial.println("Waveshare ESP32-S3-ETH-8DI-8RO");
  Serial.println("================================================");
  inputService.begin();
  relayBoard.begin();
  temperatureService.begin();
  wifiService.begin();
  safetyController.begin(relayBoard, inputService);
}

void loop() {
  wifiService.update();
  inputService.update();
  safetyController.update();
  const unsigned long now = millis();
  if (now - lastTemperatureReadMs >= GC_TEMPERATURE_INTERVAL_MS) {
    lastTemperatureReadMs = now;
    lastTemperatureC = temperatureService.readCelsius();
    if (isnan(lastTemperatureC)) Serial.println("Temperatur: Sensor nicht verfügbar.");
    else Serial.printf("Temperatur: %.2f °C\n", lastTemperatureC);
    safetyController.setTemperature(lastTemperatureC);
  }
  if (wifiService.isConnected() && now - lastHeartbeatMs >= GC_HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatMs = now;
    GCDeviceState state;
    state.temperatureC = lastTemperatureC;
    state.wifiRssi = WiFi.RSSI();
    state.uptimeSeconds = now / 1000UL;
    state.roofOpen = inputService.roofOpen();
    state.roofClosed = inputService.roofClosed();
    state.wallOpen = inputService.wallOpen();
    state.wallClosed = inputService.wallClosed();
    state.pressureOk = inputService.pressureOk();
    state.wateringOn = relayBoard.isOn(GC_RELAY_WATERING);
    state.heatingOn = relayBoard.isOn(GC_RELAY_HEATING);
    GCCloudCommands commands;
    if (cloudClient.sendHeartbeat(state, commands)) safetyController.applyCloudCommands(commands);
  }
  delay(20);
}
