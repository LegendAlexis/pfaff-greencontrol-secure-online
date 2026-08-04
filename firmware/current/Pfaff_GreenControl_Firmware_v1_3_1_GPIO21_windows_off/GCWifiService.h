#pragma once
#include <Arduino.h>
#include <WiFi.h>
class GCWifiService {
 public: void begin(); void update(); bool isConnected() const;
 private: void startConnection(); unsigned long lastAttemptMs_=0; bool announcedConnected_=false;
};
