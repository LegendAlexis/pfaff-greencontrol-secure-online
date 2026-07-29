#include "GCTemperatureService.h"
#include "GCConfig.h"

namespace {
constexpr uint8_t TEMPERATURE_SENSOR_PIN = 21;
}

GCTemperatureService::GCTemperatureService()
  : oneWire_(TEMPERATURE_SENSOR_PIN), sensors_(&oneWire_) {}

void GCTemperatureService::begin() {
  sensors_.begin();
  sensors_.setResolution(12);
  count_ = sensors_.getDeviceCount();

  Serial.printf("DS18B20 Datenpin: GPIO%u\n", TEMPERATURE_SENSOR_PIN);
  Serial.printf("DS18B20 Sensoren gefunden: %u\n", count_);

  if (count_ == 0) {
    Serial.println(
      "Hinweis: DATA an GPIO21, VDD an 3V3, GND an G, "
      "4.7-kOhm Pull-up DATA-3V3."
    );
  }
}

float GCTemperatureService::readCelsius() {
  sensors_.requestTemperatures();
  const float value = sensors_.getTempCByIndex(0);

  if (
    value == DEVICE_DISCONNECTED_C ||
    value < GC_VALID_TEMP_MIN_C ||
    value > GC_VALID_TEMP_MAX_C
  ) {
    return NAN;
  }

  return value;
}

uint8_t GCTemperatureService::sensorCount() const {
  return count_;
}
