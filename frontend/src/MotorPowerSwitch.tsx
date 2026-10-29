import { useId, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { useData } from "./data";
import { powerPresentation } from "./motor-state";
import type { Pump } from "./types";

export default function MotorPowerSwitch({
  pump,
  compact = false,
}: {
  pump: Pump;
  compact?: boolean;
}) {
  const {
    demo,
    motorStates,
    motorStatesLoading,
    motorStateError,
    motorStateBusy,
    setMotorPower,
    refreshMotorStates,
  } = useData();
  const [error, setError] = useState(""),
    descriptionId = useId();
  const state = motorStates[pump.id],
    busy = !!motorStateBusy[pump.id];
  const view = powerPresentation(state, demo, !!motorStateError);
  async function toggle() {
    setError("");
    try {
      await setMotorPower(pump.id, view.nextState);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not change motor state",
      );
    }
  }
  return (
    <div className={`motor-power ${compact ? "compact" : "panel"}`}>
      <div className="motor-power-row">
        <div className="motor-power-copy">
          <strong>Motor power</strong>
          <div>
            <span>
              {state?.is_simulated || pump.source === "demo"
                ? "Simulated"
                : "Reported"}
              :{" "}
              <b>
                {motorStatesLoading ? "Loading…" : view.reported.toUpperCase()}
              </b>
            </span>
            {view.pending && !motorStateError && <em>Pending</em>}
          </div>
        </div>
        <button
          type="button"
          className={`power-switch ${view.reported === "unknown" && !view.requested ? "unknown" : ""}`}
          role="switch"
          aria-label={`Requested power for ${pump.motor_name}`}
          aria-checked={view.checked}
          aria-describedby={descriptionId}
          aria-busy={busy}
          title={`Request motor ${view.nextState}`}
          data-on={view.checked}
          disabled={busy || motorStatesLoading || !!motorStateError}
          onClick={() => void toggle()}
        >
          <span className="power-switch-knob">
            {busy && <LoaderCircle size={13} className="spin" />}
          </span>
        </button>
      </div>
      <p className="motor-power-message" id={descriptionId} role="status">
        {motorStatesLoading
          ? "Loading motor state…"
          : busy
            ? "Saving state request…"
            : view.message}
      </p>
      {error && (
        <p className="motor-power-error" role="alert">
          {error}
        </p>
      )}
      {motorStateError && (
        <div className="motor-power-retry">
          <p role="alert">Could not refresh motor state.</p>
          <button type="button" onClick={() => void refreshMotorStates()}>
            <RefreshCw size={11} /> Retry
          </button>
        </div>
      )}
    </div>
  );
}
