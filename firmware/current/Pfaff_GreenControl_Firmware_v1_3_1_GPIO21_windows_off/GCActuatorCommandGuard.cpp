#include "GCActuatorCommandGuard.h"

GCCommandGuardDecision GCActuatorCommandGuard::evaluate(
  const GCParsedCommand& command,
  GCCommandActuator expectedActuator,
  GCCommandStateStore& stateStore,
  GCAcknowledgement& acknowledgement
) {
  acknowledgement = GCAcknowledgement{};
  if (!structurallyValid(command, expectedActuator)) {
    return GCCommandGuardDecision::Invalid;
  }

  GCAcknowledgement pending;
  if (stateStore.loadPendingAcknowledgement(expectedActuator, pending)) {
    if (
      pending.commandId == command.id &&
      pending.sequence == command.sequence
    ) {
      acknowledgement = pending;
      return GCCommandGuardDecision::ReusePendingAcknowledgement;
    }

    // One unresolved ACK per actor is the durability boundary. A newer command
    // must wait until C3 has accepted the existing ACK.
    return GCCommandGuardDecision::Invalid;
  }

  const uint64_t lastApplied =
    stateStore.loadSequences().get(expectedActuator);
  if (command.sequence < lastApplied) {
    return GCCommandGuardDecision::Superseded;
  }
  if (command.sequence == lastApplied) {
    return GCCommandGuardDecision::AlreadyApplied;
  }
  return GCCommandGuardDecision::Apply;
}

bool GCActuatorCommandGuard::persistDecision(
  GCCommandStateStore& stateStore,
  const GCParsedCommand& command,
  GCAcknowledgement& acknowledgement,
  const char* status,
  const char* reason
) {
  acknowledgement.pending = true;
  acknowledgement.commandId = command.id;
  acknowledgement.actuator = command.actuator;
  acknowledgement.sequence = command.sequence;
  acknowledgement.status = status == nullptr ? "failed" : status;
  acknowledgement.reason = reason == nullptr ? "" : reason;
  return stateStore.savePendingAcknowledgement(acknowledgement);
}

void GCActuatorCommandGuard::setWateringState(
  GCAcknowledgement& acknowledgement,
  bool on
) {
  acknowledgement.wateringState = on ? "on" : "off";
}

void GCActuatorCommandGuard::setDisabledWindowState(
  GCAcknowledgement& acknowledgement
) {
  acknowledgement.windowPosition = "disabled";
  acknowledgement.windowMovement = "stopped";
}

bool GCActuatorCommandGuard::structurallyValid(
  const GCParsedCommand& command,
  GCCommandActuator expectedActuator
) {
  if (
    command.id.isEmpty() ||
    command.sequence == 0 ||
    command.actuator != expectedActuator ||
    command.createdAt.isEmpty() ||
    command.expiresAt.isEmpty()
  ) {
    return false;
  }

  if (expectedActuator == GCCommandActuator::Watering) {
    return (
      command.operation == GCCommandOperation::WateringOn ||
      command.operation == GCCommandOperation::WateringOff
    );
  }

  return (
    command.operation == GCCommandOperation::WindowOpen ||
    command.operation == GCCommandOperation::WindowStop ||
    command.operation == GCCommandOperation::WindowClose
  );
}
