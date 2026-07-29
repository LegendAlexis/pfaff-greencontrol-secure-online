#include "GCRelayBoard.h"
#include "GCConfig.h"

namespace {
constexpr uint8_t OUT = 0x01;
constexpr uint8_t POL = 0x02;
constexpr uint8_t CFG = 0x03;
}

bool GCRelayBoard::writeRegister(uint8_t r, uint8_t v) {
  Wire.beginTransmission(GC_TCA9554_ADDRESS);
  Wire.write(r);
  Wire.write(v);
  return Wire.endTransmission() == 0;
}

bool GCRelayBoard::writeOutputs() {
  const uint8_t physicalState = GC_RELAY_ACTIVE_HIGH
    ? logicalState_
    : static_cast<uint8_t>(~logicalState_);
  return writeRegister(OUT, physicalState);
}

static bool permitted(uint8_t channel) {
  // Dach und Wand sind voruebergehend vollstaendig deaktiviert.
  if (
    channel == GC_RELAY_ROOF_OPEN ||
    channel == GC_RELAY_ROOF_CLOSE ||
    channel == GC_RELAY_WALL_OPEN ||
    channel == GC_RELAY_WALL_CLOSE
  ) {
    return false;
  }

  // Die bestehende globale Freigabe aus GCConfig.h bleibt unveraendert.
  if (
    channel == GC_RELAY_WATERING ||
    channel == GC_RELAY_HEATING
  ) {
    return GC_ENABLE_OUTPUTS;
  }

  return false;
}

void GCRelayBoard::begin() {
  Wire.begin(GC_I2C_SDA_PIN, GC_I2C_SCL_PIN);
  Serial.printf(
    "I2C gestartet: SDA GPIO%u, SCL GPIO%u\n",
    GC_I2C_SDA_PIN,
    GC_I2C_SCL_PIN
  );

  logicalState_ = 0;
  const uint8_t off = GC_RELAY_ACTIVE_HIGH ? 0x00 : 0xFF;

  if (
    !writeRegister(OUT, off) ||
    !writeRegister(POL, 0) ||
    !writeRegister(CFG, 0)
  ) {
    Serial.printf(
      "FEHLER: TCA9554 bei 0x%02X nicht erreichbar.\n",
      GC_TCA9554_ADDRESS
    );
    return;
  }

  available_ = writeOutputs();
  if (available_) {
    Serial.println("Relaisboard erkannt. Alle Relais AUS.");
    Serial.println("Fenster CH1-CH4 voruebergehend deaktiviert.");
  }
}

bool GCRelayBoard::available() const {
  return available_;
}

bool GCRelayBoard::set(uint8_t channel, bool on) {
  if (!available_ || channel > 7) return false;

  if (on && !permitted(channel)) {
    Serial.printf("BLOCKIERT: CH%u nicht freigegeben.\n", channel + 1);
    return false;
  }

  const bool before = isOn(channel);

  if (on) {
    logicalState_ |= static_cast<uint8_t>(1U << channel);
  } else {
    logicalState_ &= static_cast<uint8_t>(~(1U << channel));
  }

  const bool ok = writeOutputs();
  if (ok && before != on) {
    Serial.printf("RELAIS CH%u -> %s\n", channel + 1, on ? "EIN" : "AUS");
  }

  return ok;
}

bool GCRelayBoard::isOn(uint8_t channel) const {
  return channel <= 7 &&
    (logicalState_ & static_cast<uint8_t>(1U << channel));
}

void GCRelayBoard::allOff() {
  logicalState_ = 0;
  if (available_) writeOutputs();
  Serial.println("SICHERHEIT: Alle Relais AUS.");
}
