#include "GCSafetyController.h"
#include "GCConfig.h"

void GCSafetyController::begin(GCRelayBoard& r, GCInputService& i) {
  r_ = &r;
  i_ = &i;
  r_->allOff();
}

void GCSafetyController::setTemperature(float t) {
  t_ = t;
  if (!isnan(t_) && t_ <= GC_WATERING_FROST_LOCK_C) setWatering(false);
}

void GCSafetyController::stopRoof() {
  if (!r_) return;
  r_->set(GC_RELAY_ROOF_OPEN, false);
  r_->set(GC_RELAY_ROOF_CLOSE, false);
  rs_ = 0;
}

void GCSafetyController::stopWall() {
  if (!r_) return;
  r_->set(GC_RELAY_WALL_OPEN, false);
  r_->set(GC_RELAY_WALL_CLOSE, false);
  ws_ = 0;
}

void GCSafetyController::moveRoof(bool) {
  // Dachfenster voruebergehend deaktiviert.
  stopRoof();
}

void GCSafetyController::moveWall(bool) {
  // Wandfenster voruebergehend deaktiviert.
  stopWall();
}

void GCSafetyController::setWatering(bool on) {
  if (!r_) return;
  if (on && !isnan(t_) && t_ <= GC_WATERING_FROST_LOCK_C) {
    Serial.println("SICHERHEIT: Bewaesserung wegen Frost gesperrt.");
    on = false;
  }
  Serial.printf("ANFORDERUNG: Bewaesserung %s.\n", on ? "EIN" : "AUS");
  r_->set(GC_RELAY_WATERING, on);
}

void GCSafetyController::setHeating(bool on) {
  if (r_) {
    Serial.printf("ANFORDERUNG: Heizung %s.\n", on ? "EIN" : "AUS");
    r_->set(GC_RELAY_HEATING, on);
  }
}

void GCSafetyController::update() {
  if (!r_ || !i_) return;

  if (r_->isOn(GC_RELAY_ROOF_OPEN) && i_->roofOpen()) {
    Serial.println("ENDLAGE: Dach offen.");
    stopRoof();
  }
  if (r_->isOn(GC_RELAY_ROOF_CLOSE) && i_->roofClosed()) {
    Serial.println("ENDLAGE: Dach geschlossen.");
    stopRoof();
  }
  if (r_->isOn(GC_RELAY_WALL_OPEN) && i_->wallOpen()) {
    Serial.println("ENDLAGE: Wand offen.");
    stopWall();
  }
  if (r_->isOn(GC_RELAY_WALL_CLOSE) && i_->wallClosed()) {
    Serial.println("ENDLAGE: Wand geschlossen.");
    stopWall();
  }
  if (r_->isOn(GC_RELAY_ROOF_OPEN) && r_->isOn(GC_RELAY_ROOF_CLOSE)) {
    Serial.println("NOT-AUS: Beide Dachrichtungen aktiv.");
    stopRoof();
  }
  if (r_->isOn(GC_RELAY_WALL_OPEN) && r_->isOn(GC_RELAY_WALL_CLOSE)) {
    Serial.println("NOT-AUS: Beide Wandrichtungen aktiv.");
    stopWall();
  }

  const unsigned long now = millis();
  if (rs_ && now - rs_ > GC_MAX_MOTOR_RUNTIME_MS) {
    Serial.println("SICHERHEIT: Dach-Laufzeit ueberschritten.");
    stopRoof();
  }
  if (ws_ && now - ws_ > GC_MAX_MOTOR_RUNTIME_MS) {
    Serial.println("SICHERHEIT: Wand-Laufzeit ueberschritten.");
    stopWall();
  }
  if (last_ && now - last_ > GC_CLOUD_COMMAND_TIMEOUT_MS) {
    Serial.println("SICHERHEIT: Cloud-Befehl veraltet.");
    stopRoof();
    stopWall();
    setWatering(false);
    last_ = now;
  }
}

void GCSafetyController::applyCloudCommands(const GCCloudCommands& c) {
  if (!c.valid) return;
  last_ = millis();

  // Dach- und Wandfenster sind voruebergehend deaktiviert.
  // Cloud-Befehle fuer CH1 bis CH4 werden absichtlich ignoriert.

  if (
    c.hasWateringTarget &&
    r_->isOn(GC_RELAY_WATERING) != c.wateringTargetOn
  ) {
    setWatering(c.wateringTargetOn);
  }

  if (
    c.hasHeatingTarget &&
    r_->isOn(GC_RELAY_HEATING) != c.heatingTargetOn
  ) {
    setHeating(c.heatingTargetOn);
  }
}
