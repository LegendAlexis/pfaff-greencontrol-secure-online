#pragma once
#include <Arduino.h>
#include <Wire.h>
class GCRelayBoard {
 public: void begin(); bool available() const; bool set(uint8_t channel,bool on); bool isOn(uint8_t channel) const; void allOff();
 private: bool writeRegister(uint8_t reg,uint8_t value); bool writeOutputs(); bool available_=false; uint8_t logicalState_=0;
};
