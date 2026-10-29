import type { MotorState, Pump } from "./types.ts";

export function mergeMotorStates(
  current: Record<string, MotorState>,
  incoming: MotorState[],
) {
  const next = { ...current };
  for (const state of incoming) {
    if (
      !next[state.motor_id] ||
      state.revision >= next[state.motor_id].revision
    )
      next[state.motor_id] = state;
  }
  return next;
}

export function previewStates(pumps: Pump[]): Record<string, MotorState> {
  return Object.fromEntries(
    pumps.map((pump) => [
      pump.id,
      {
        motor_id: pump.id,
        motor_oid: pump.motor_oid,
        motor_name: pump.motor_name,
        is_simulated: true,
        state: "off",
        is_on: false,
        desired_state: "off",
        last_reported_state: "off",
        confirmation_source: "demo",
        reported_at: null,
        requested_at: null,
        stale: false,
        freshness_timeout_seconds: 300,
        command_id: null,
        command_status: "simulated",
        revision: 0,
      } satisfies MotorState,
    ]),
  );
}

export function powerPresentation(
  state: MotorState | undefined,
  offlineDemo = false,
  unavailable = false,
) {
  const reported = unavailable ? "unknown" : state?.state || "unknown";
  const requested =
    state?.desired_state ?? (reported === "unknown" ? null : reported);
  const checked = requested === "on";
  const pending = state?.command_status === "pending_device";
  let message = "No device state received. Use the switch to request a state.";
  if (unavailable)
    message = "State unavailable. Reconnect before changing power.";
  else if (offlineDemo)
    message = `Demo ${checked ? "on" : "off"} · this session only`;
  else if (pending)
    message = `${checked ? "On" : "Off"} requested · waiting for ESP32`;
  else if (state?.stale)
    message = "Device report expired · current state unknown";
  else if (state?.is_simulated && reported !== "unknown")
    message = `Simulated ${reported} · saved to database`;
  else if (requested && reported !== "unknown" && requested !== reported)
    message = `Requested ${requested} · device reports ${reported}`;
  else if (reported !== "unknown") message = `ESP32 reports motor ${reported}`;
  return {
    reported,
    requested,
    checked,
    pending,
    message,
    nextState: checked ? ("off" as const) : ("on" as const),
  };
}
