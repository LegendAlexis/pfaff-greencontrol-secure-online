#pragma once
#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>
class GCTemperatureService {
 public: GCTemperatureService(); void begin(); float readCelsius(); uint8_t sensorCount() const;
 private: OneWire oneWire_; DallasTemperature sensors_; uint8_t count_=0;
};
