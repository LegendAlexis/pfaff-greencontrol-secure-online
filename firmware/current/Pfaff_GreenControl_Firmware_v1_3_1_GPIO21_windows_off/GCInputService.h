#pragma once
#include <Arduino.h>
class GCInputService {
 public: void begin(); void update(); bool roofOpen()const; bool roofClosed()const; bool wallOpen()const; bool wallClosed()const; bool pressureOk()const;
 private: bool active(uint8_t pin)const;
};
