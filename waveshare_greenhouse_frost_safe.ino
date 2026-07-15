#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <time.h>

// WLAN
const char* WIFI_SSID = "PfaffBio_EXT";
const char* WIFI_PASSWORD = "PfaFF-2026-BIO";

// Supabase
const char* SUPABASE_KEY = "sb_publishable_ddTEiOH85Nu5WLCP-tdd9Q_qBtdmc5A";

const char* GREENHOUSE_GET_URL =
  "https://dkfvqgnpwvfzqgdnhypw.supabase.co/rest/v1/greenhouses?id=eq.1&select=*";

const char* GREENHOUSE_UPDATE_URL =
  "https://dkfvqgnpwvfzqgdnhypw.supabase.co/rest/v1/greenhouses?id=eq.1";

const char* SCHEDULE_GET_URL =
  "https://dkfvqgnpwvfzqgdnhypw.supabase.co/rest/v1/watering_schedule?greenhouse_id=eq.1&enabled=eq.true&select=*";

// Waveshare TCA9554 Relais
#define TCA9554_ADDR 0x20
#define I2C_SDA 42
#define I2C_SCL 41

// Kanalplan
#define CH_ROOF  1
#define CH_WALL  2
#define CH_WATER 3

// Normale Logik:
// Ziel AN/OFFEN = Relais-Licht AN
// Ziel AUS/ZU   = Relais-Licht AUS
const bool ROOF_INVERTED = false;
const bool WALL_INVERTED = false;
const bool WATER_INVERTED = false;

// DS18B20
#define TEMP_SENSOR_PIN 21
OneWire oneWire(TEMP_SENSOR_PIN);
DallasTemperature tempSensor(&oneWire);

// Zeiten
const unsigned long LOOP_INTERVAL_MS = 3000;
const unsigned long TEMP_INTERVAL_MS = 5000;
const unsigned long STATUS_INTERVAL_MS = 10000;
const unsigned long WIFI_TIMEOUT_MS = 15000;

// Frostschutz
const float FROST_LIMIT_C = 0.0;

// Zustände
uint8_t relayState = 0xFF;
uint8_t lastRelayState = 0xFF;

bool firstRun = true;
bool lastRoofFinal = false;
bool lastWallFinal = false;
bool lastWaterFinal = false;

float lastTemperature = NAN;

unsigned long lastTempRead = 0;
unsigned long lastStatusUpdate = 0;

void writeTCA(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(TCA9554_ADDR);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

void applyRelays() {
  if (relayState == lastRelayState) {
    Serial.println("Relais unverändert.");
    return;
  }

  writeTCA(0x01, relayState);
  lastRelayState = relayState;

  Serial.print("Relais gesetzt: 0b");
  Serial.println(relayState, BIN);
}

void setRelay(int channel, bool on, bool inverted = false) {
  bool finalOn = inverted ? !on : on;
  int bit = channel - 1;

  if (finalOn) {
    relayState &= ~(1 << bit);
  } else {
    relayState |= (1 << bit);
  }
}

void allRelaysOff() {
  relayState = 0xFF;
  applyRelays();
  Serial.println("SICHERHEIT: Alle Relais AUS");
}

bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;

  Serial.println("WLAN nicht verbunden. Verbinde neu...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT_MS) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WLAN verbunden");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    return true;
  }

  Serial.println("WLAN FEHLER -> Sicherheit AUS");
  allRelaysOff();
  return false;
}

String httpsGet(const char* url) {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.begin(client, url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);

  int code = http.GET();

  Serial.print("GET HTTP: ");
  Serial.println(code);

  if (code != 200) {
    Serial.println(http.getString());
    http.end();
    return "";
  }

  String payload = http.getString();
  http.end();

  return payload;
}

String getIsoTime() {
  struct tm timeinfo;

  if (!getLocalTime(&timeinfo)) {
    return "";
  }

  char buffer[30];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buffer);
}

float readTemperature() {
  tempSensor.requestTemperatures();

  float temp = tempSensor.getTempCByIndex(0);

  if (temp == DEVICE_DISCONNECTED_C || temp < -55 || temp > 125) {
    Serial.println("Temperatursensor Fehler");
    return NAN;
  }

  Serial.print("Temperatur: ");
  Serial.print(temp);
  Serial.println(" °C");

  return temp;
}

bool isWateringTime() {
  String payload = httpsGet(SCHEDULE_GET_URL);

  if (payload == "") {
    Serial.println("Zeitplan konnte nicht gelesen werden.");
    return false;
  }

  StaticJsonDocument<4096> doc;
  DeserializationError error = deserializeJson(doc, payload);

  if (error) {
    Serial.println("Zeitplan JSON Fehler.");
    return false;
  }

  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Keine Uhrzeit verfügbar.");
    return false;
  }

  int nowMinutes = timeinfo.tm_hour * 60 + timeinfo.tm_min;

  for (JsonObject item : doc.as<JsonArray>()) {
    const char* startTime = item["start_time"] | "00:00";
    int duration = item["duration_minutes"] | 0;

    int hour = String(startTime).substring(0, 2).toInt();
    int minute = String(startTime).substring(3, 5).toInt();

    int startMinutes = hour * 60 + minute;
    int endMinutes = startMinutes + duration;

    if (nowMinutes >= startMinutes && nowMinutes < endMinutes) {
      return true;
    }
  }

  return false;
}

void updateStatus(
  bool roofOpen,
  bool wallOpen,
  bool waterOn,
  float temperature,
  const char* statusText
) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.begin(client, GREENHOUSE_UPDATE_URL);

  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=minimal");

  String now = getIsoTime();

  String body = "{";
  body += "\"roof_window_open\":" + String(roofOpen ? "true" : "false") + ",";
  body += "\"wall_window_open\":" + String(wallOpen ? "true" : "false") + ",";
  body += "\"watering_on\":" + String(waterOn ? "true" : "false") + ",";
  body += "\"status\":\"" + String(statusText) + "\"";

  if (!isnan(temperature)) {
    body += ",\"temperature\":" + String(temperature, 2);
  }

  if (now != "") {
    body += ",\"last_seen\":\"" + now + "\"";
  }

  body += "}";

  int code = http.PATCH(body);

  Serial.print("Status Update HTTP: ");
  Serial.println(code);

  if (code < 200 || code > 299) {
    Serial.println(http.getString());
  }

  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println("Smart Greenhouse Waveshare startet...");

  Wire.begin(I2C_SDA, I2C_SCL);
  delay(500);

  writeTCA(0x03, 0x00);
  allRelaysOff();

  tempSensor.begin();

  WiFi.mode(WIFI_STA);
  connectWiFi();

  configTzTime(
    "CET-1CEST,M3.5.0/2,M10.5.0/3",
    "pool.ntp.org",
    "time.nist.gov"
  );

  Serial.println("Setup fertig.");
}

void loop() {
  if (!connectWiFi()) {
    delay(5000);
    return;
  }

  if (firstRun || millis() - lastTempRead >= TEMP_INTERVAL_MS) {
    lastTemperature = readTemperature();
    lastTempRead = millis();
  }

  String payload = httpsGet(GREENHOUSE_GET_URL);

  if (payload == "") {
    Serial.println("Supabase Fehler -> Sicherheit AUS");
    allRelaysOff();
    updateStatus(false, false, false, lastTemperature, "supabase_error");
    delay(5000);
    return;
  }

  StaticJsonDocument<4096> doc;
  DeserializationError error = deserializeJson(doc, payload);

  if (error || doc.size() == 0) {
    Serial.println("JSON Fehler -> Sicherheit AUS");
    allRelaysOff();
    updateStatus(false, false, false, lastTemperature, "json_error");
    delay(5000);
    return;
  }

  JsonObject gh = doc[0];

  bool autoMode = gh["auto_mode"] | false;
  bool warningActive = gh["warning_active"] | false;

  bool roofTarget = gh["roof_window_target"] | false;
  bool wallTarget = gh["wall_window_target"] | false;
  bool waterTarget = gh["watering_target"] | false;

  bool roofManual = gh["roof_manual_override"] | false;
  bool wallManual = gh["wall_manual_override"] | false;
  bool waterManual = gh["watering_manual_override"] | false;

  float roofOpenTemp = gh["roof_temperature_open"] | 28.0;
  float roofCloseTemp = gh["roof_temperature_close"] | 24.0;
  float wallOpenTemp = gh["wall_temperature_open"] | 30.0;
  float wallCloseTemp = gh["wall_temperature_close"] | 25.0;

  if (warningActive) {
    Serial.println("WARNUNG AKTIV -> Sicherheit AUS");
    allRelaysOff();
    updateStatus(false, false, false, lastTemperature, "warning_stop");
    delay(5000);
    return;
  }

  bool finalRoof = roofTarget;
  bool finalWall = wallTarget;
  bool finalWater = waterTarget;
  bool frostProtection = false;

  if (autoMode && !isnan(lastTemperature)) {
    if (!roofManual) {
      if (lastTemperature >= roofOpenTemp) {
        finalRoof = true;
      } else if (lastTemperature <= roofCloseTemp) {
        finalRoof = false;
      }
    }

    if (!wallManual) {
      if (lastTemperature >= wallOpenTemp) {
        finalWall = true;
      } else if (lastTemperature <= wallCloseTemp) {
        finalWall = false;
      }
    }
  }

  if (autoMode && !waterManual) {
    finalWater = isWateringTime();
  }

  // Frostschutz hat höchste Priorität für Bewässerung.
  // Auch manuelles Starten darf bei 0°C oder darunter nicht aktiv werden.
  if (!isnan(lastTemperature) && lastTemperature <= FROST_LIMIT_C) {
    finalWater = false;
    frostProtection = true;
    Serial.println("FROSTSCHUTZ: Bewässerung gesperrt.");
  }

  Serial.println("----- Zustand -----");
  Serial.print("Auto-Modus: ");
  Serial.println(autoMode ? "AN" : "AUS");

  Serial.print("Temperatur: ");
  if (isnan(lastTemperature)) {
    Serial.println("ungueltig");
  } else {
    Serial.println(lastTemperature);
  }

  Serial.print("Dach final: ");
  Serial.println(finalRoof ? "OFFEN/AN" : "ZU/AUS");

  Serial.print("Wand final: ");
  Serial.println(finalWall ? "OFFEN/AN" : "ZU/AUS");

  Serial.print("Wasser final: ");
  Serial.println(finalWater ? "AN" : "AUS");

  bool relayChanged = false;

  if (firstRun || finalRoof != lastRoofFinal) {
    setRelay(CH_ROOF, finalRoof, ROOF_INVERTED);
    lastRoofFinal = finalRoof;
    relayChanged = true;
  }

  if (firstRun || finalWall != lastWallFinal) {
    setRelay(CH_WALL, finalWall, WALL_INVERTED);
    lastWallFinal = finalWall;
    relayChanged = true;
  }

  if (firstRun || finalWater != lastWaterFinal) {
    setRelay(CH_WATER, finalWater, WATER_INVERTED);
    lastWaterFinal = finalWater;
    relayChanged = true;
  }

  if (relayChanged) {
    applyRelays();
  } else {
    Serial.println("Keine Relaisänderung.");
  }

  const char* statusText = frostProtection ? "frost_protection" : "online";

  if (
    relayChanged ||
    firstRun ||
    millis() - lastStatusUpdate >= STATUS_INTERVAL_MS
  ) {
    updateStatus(finalRoof, finalWall, finalWater, lastTemperature, statusText);
    lastStatusUpdate = millis();
  }

  firstRun = false;

  delay(LOOP_INTERVAL_MS);
}
