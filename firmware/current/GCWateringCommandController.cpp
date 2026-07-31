#include "GCWateringCommandController.h"

#include "GCConfig.h"

void GCWateringCommandController::begin(
  GCRelayBoard& relayBoard,
  GCCommandStateStore& stateStore
) {
  relayBoard_ = &relayBoard;
  stateStore_ = &stateStore;
}

void GCWateringCommandController::setTemperature(
  float temperatureC,
  unsigned long measuredAtMs
) {
  temperatureC_ = temperatureC;
  temperatureMeasuredAtMs_ = measuredAtMs;
}

bool GCWateringCommandController::process(
  const GCParsedCommand& command,
  GCAcknowledgement& acknowledgement
) {
  if (relayBoard_ == nullptr || stateStore_ == nullptr) return false;

  const GCCommandGuardDecision decision = GCActuatorCommandGuard::evaluate(
    command,
    GCCommandActuator::Watering,
    *stateStore_,
    acknowledgement
  );
  if (decision == GCCommandGuardDecision::ReusePendingAcknowledgement) {
    return true;
  }
  if (decision != GCCommandGuardDecision::Apply) {
    return persistWithoutAction(command, decision, acknowledgement);
  }

  const bool targetOn = command.operation == GCCommandOperation::WateringOn;
  const bool temperatureIsCurrent =
    temperatureMeasuredAtMs_ != 0 &&
    millis() - temperatureMeasuredAtMs_ <= GC_TEMPERATURE_MAX_AGE_MS;
  if (targetOn && (!temperatureIsCurrent || isnan(temperatureC_))) {
    Serial.println(
      "SICHERHEIT: Bewaesserung EIN ohne aktuelle Temperatur gesperrt."
    );
    GCActuatorCommandGuard::setWateringState(
      acknowledgement,
      relayBoard_->isOn(GC_RELAY_WATERING)
    );
    return GCActuatorCommandGuard::persistDecision(
      *stateStore_, command, acknowledgement, "rejected", "frost_lock"
    );
  }

  if (targetOn && temperatureC_ <= GC_WATERING_FROST_LOCK_C) {
    Serial.println("SICHERHEIT: Bewaesserung EIN wegen Frost gesperrt.");
    GCActuatorCommandGuard::setWateringState(
      acknowledgement,
      relayBoard_->isOn(GC_RELAY_WATERING)
    );
    return GCActuatorCommandGuard::persistDecision(
      *stateStore_, command, acknowledgement, "rejected", "frost_lock"
    );
  }

  if (targetOn && !GC_ENABLE_OUTPUTS) {
    GCActuatorCommandGuard::setWateringState(
      acknowledgement,
      relayBoard_->isOn(GC_RELAY_WATERING)
    );
    return GCActuatorCommandGuard::persistDecision(
      *stateStore_, command, acknowledgement, "rejected", "output_disabled"
    );
  }

  if (!relayBoard_->available()) {
    GCActuatorCommandGuard::setWateringState(acknowledgement, false);
    return GCActuatorCommandGuard::persistDecision(
      *stateStore_, command, acknowledgement, "failed", "relay_unavailable"
    );
  }

  // Persist the monotone sequence before the output transition. A reset can
  // therefore never execute the same command sequence a second time.
  if (!stateStore_->saveSequence(command.actuator, command.sequence)) {
    return false;
  }

  const bool alreadyAtTarget =
    relayBoard_->isOn(GC_RELAY_WATERING) == targetOn;
  if (!alreadyAtTarget && !relayBoard_->set(GC_RELAY_WATERING, targetOn)) {
    GCActuatorCommandGuard::setWateringState(
      acknowledgement,
      relayBoard_->isOn(GC_RELAY_WATERING)
    );
    return GCActuatorCommandGuard::persistDecision(
      *stateStore_, command, acknowledgement, "failed", "relay_write_failed"
    );
  }

  GCActuatorCommandGuard::setWateringState(acknowledgement, targetOn);
  return GCActuatorCommandGuard::persistDecision(
    *stateStore_, command, acknowledgement, "applied"
  );
}

bool GCWateringCommandController::persistWithoutAction(
  const GCParsedCommand& command,
  GCCommandGuardDecision decision,
  GCAcknowledgement& acknowledgement
) {
  GCActuatorCommandGuard::setWateringState(
    acknowledgement,
    relayBoard_->isOn(GC_RELAY_WATERING)
  );
  if (decision == GCCommandGuardDecision::AlreadyApplied) {
    return GCActuatorCommandGuard::persistDecision(
      *stateStore_, command, acknowledgement, "already_applied"
    );
  }
  if (decision == GCCommandGuardDecision::Superseded) {
    return GCActuatorCommandGuard::persistDecision(
      *stateStore_, command, acknowledgement, "superseded", "stale_sequence"
    );
  }
  return false;
}
