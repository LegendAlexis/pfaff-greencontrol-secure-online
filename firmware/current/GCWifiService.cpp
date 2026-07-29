#include "GCWifiService.h"
#include "GCConfig.h"
void GCWifiService::begin(){WiFi.mode(WIFI_STA);WiFi.setAutoReconnect(true);WiFi.setHostname(GC_HOSTNAME);startConnection();}
void GCWifiService::startConnection(){lastAttemptMs_=millis();announcedConnected_=false;Serial.printf("Verbinde mit WLAN \"%s\" ...\n",GC_WIFI_SSID);WiFi.begin(GC_WIFI_SSID,GC_WIFI_PASSWORD);}
void GCWifiService::update(){if(WiFi.status()==WL_CONNECTED){if(!announcedConnected_){announcedConnected_=true;Serial.println("WLAN verbunden.");Serial.print("IP-Adresse: ");Serial.println(WiFi.localIP());Serial.printf("Signalstärke: %d dBm\n",WiFi.RSSI());}return;}announcedConnected_=false;if(millis()-lastAttemptMs_>=GC_WIFI_RETRY_MS){WiFi.disconnect();startConnection();}}
bool GCWifiService::isConnected()const{return WiFi.status()==WL_CONNECTED;}
