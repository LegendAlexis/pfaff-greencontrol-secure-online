#include "GCSideWindowCommandController.h"

#include "GCConfig.h"

void GCSideWindowCommandController::begin(
  GCRelayBoard& relayBoard,
  GCCommandStateStore& stateStore
) {
  relayBoard_ = &relayBoard;
  stateStore_ = &stateStore;
  emergencyStop();
}

bool GCSideWindowCommandController::process(
  const GCParsedCommand& command,
  GCAcknowledgement& acknowledgement
) {
  if (relayBoard_ == nullptr || stateStore_ == nullptr) return false;

  const GCCommandGuardDecision decision = GCActuatorCommandGuard::evaluate(
    command,
    GCCommandActuator::SideWindow,
    *stateStore_,
    acknowledgement
  );
  if (decision == GCCommandGuardDecision::ReusePendingAcknowledgement) {
    return true;
  }

  emergencyStop();
  GCActuatorCommandGuard::setDisabledWindowState(acknowledgement);

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
  if (decision != GCCommandGuardDecision::Apply) return false;

  if (!stateStore_->saveSequence(command.actuator, command.sequence)) {
    return false;
  }
  return GCActuatorCommandGuard::persistDecision(
    *stateStore_, command, acknowledgement, "rejected", "component_disabled"
  );
}

bool GCSideWindowCommandController::emergencyStop() {
  if (relayBoard_ == nullptr) return false;
  const bool openOff = relayBoard_->set(GC_RELAY_WALL_OPEN, false);
  const bool closeOff = relayBoard_->set(GC_RELAY_WALL_CLOSE, false);
  return openOff && closeOff;
}
