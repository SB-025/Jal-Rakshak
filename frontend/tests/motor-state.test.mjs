import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeMotorStates,
  powerPresentation,
  previewStates,
} from "../src/motor-state.ts";

const base = {
  motor_id: "one",
  motor_oid: "PUMP-001",
  motor_name: "Pump one",
  is_simulated: false,
  state: "unknown",
  is_on: null,
  desired_state: null,
  last_reported_state: "unknown",
  confirmation_source: null,
  reported_at: null,
  requested_at: null,
  stale: false,
  freshness_timeout_seconds: 300,
  command_id: null,
  command_status: "not_requested",
  revision: 0,
};

test("an unknown motor is not presented as reported off", () => {
  const view = powerPresentation(base);
  assert.equal(view.reported, "unknown");
  assert.equal(view.requested, null);
  assert.equal(view.nextState, "on");
});
test("a pending ON request leaves reported state OFF", () => {
  const view = powerPresentation({
    ...base,
    state: "off",
    is_on: false,
    desired_state: "on",
    command_status: "pending_device",
    revision: 1,
  });
  assert.equal(view.checked, true);
  assert.equal(view.reported, "off");
  assert.equal(view.nextState, "off");
  assert.match(view.message, /waiting for ESP32/);
});
test("an old poll cannot overwrite a newer switch response", () => {
  const newer = { ...base, desired_state: "off", revision: 4 };
  const old = { ...base, desired_state: "on", revision: 3 };
  assert.equal(
    mergeMotorStates({ one: newer }, [old]).one.desired_state,
    "off",
  );
});
test("the same revision may become stale on a later poll", () => {
  const current = { ...base, state: "on", is_on: true, revision: 2 };
  const expired = { ...current, state: "unknown", is_on: null, stale: true };
  const result = mergeMotorStates({ one: current }, [expired]).one;
  assert.equal(result.state, "unknown");
  assert.match(powerPresentation(result).message, /expired/);
});
test("network failures never present an old ON state as confirmed", () => {
  assert.equal(
    powerPresentation({ ...base, state: "on" }, false, true).reported,
    "unknown",
  );
});
test("standalone demo switches say their changes are session-only", () => {
  const states = previewStates([
    { id: "one", motor_oid: "DEMO", motor_name: "Demo" },
  ]);
  assert.equal(states.one.is_simulated, true);
  assert.match(powerPresentation(states.one, true).message, /session only/);
});
