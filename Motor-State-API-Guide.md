# Motor state APIs

Both APIs use the existing `Authorization: Bearer <access_token>` login token. Base URL: `http://127.0.0.1:8000`, or the computer's LAN IP when accessed by the ESP32.

## 1. Find motors reported as on

```http
GET /motor-states?state=on
```

Each returned item identifies the motor by `motor_id`, `motor_oid`, and `motor_name`, and includes its state, requested state, command status, timestamps, and recent change history.

Other queries:

- `GET /motor-states` — all registered motors, including unknown states.
- `GET /motor-states?state=off` — motors reported off.
- `GET /motor-states?state=unknown` — no fresh state report available.
- `GET /motor-states?state=on&include_demo=false` — exclude simulated motors.
- `GET /motor-states?motor_id=PUMP-001` — state and pending command for one motor; accepts its external OID or MongoDB ID.
- `skip=0&limit=100` — pagination, maximum 500 items per response.

The response contains `items`, `total`, `skip`, and `limit`. Filtering happens before pagination. Demo motors are included by default and always have `is_simulated: true`. Registered motors without state reports return `state: unknown` and `is_on: null`; they are not assumed to be off.

## 2. Request a state change

```http
POST /motors/PUMP-001/state
Content-Type: application/json

{
  "state": "on",
  "reason": "Operator requested start"
}
```

Use `"state": "off"` to request a stop. `source` defaults to `operator`. The motor must already be registered.

For a real motor, this saves `desired_state`, creates a `command_id`, and returns `command_status: pending_device`. The reported state does not change merely because a command was requested. For example, a motor reported on remains on while an off command is pending.

For a registered demo motor, the state change is simulated immediately and returns `command_status: simulated`. No physical motor is operated.

## ESP32 workflow using the same two APIs

1. Poll `GET /motor-states?motor_id=PUMP-001` without the `state=on` filter. Read `desired_state` and `command_id`.
2. Apply a new command in the device firmware and determine the resulting state using the device's actual feedback. This backend does not implement relay control or an independent hardware readback.
3. Report the applied state through the same POST endpoint, replacing the command identifier below with the one returned by the server:

```json
{
  "state": "on",
  "source": "device",
  "command_id": "RETURNED_24_CHARACTER_COMMAND_ID"
}
```

The acknowledgement must match the latest command and requested state. Old command acknowledgements and out-of-order reports return HTTP 409. Concurrent updates use revision checks; on a conflict, fetch the current state and retry.

The device can also send a state heartbeat without acknowledging a command:

```json
{
  "state": "on",
  "source": "device"
}
```

An optional timezone-aware `reported_at` records the device measurement time. Omit it to use server receipt time. Future timestamps are rejected. A real motor report older than five minutes is displayed as unknown, while `last_reported_state` preserves its last known value. Set `MOTOR_STATE_TTL_SECONDS` on the backend to change the freshness timeout.

The prototype uses the existing authenticated account for these requests. `source: device` identifies an authenticated client report; the backend does not independently prove a physical motor is running. Existing `/readings` sensor uploads continue unchanged; send state reports through the state endpoint.

## MongoDB model

Collection: `motor_states`, with one document per `motor_id` and a unique index.

Stored fields include:

```text
motor_id
desired_state                 on / off / null
reported_state                on / off / unknown
requested_at
reported_at
command_id
acknowledged_command_id
confirmation_source           device / demo / null
revision
updated_at
history[]                     latest 100 command, state-change, and acknowledgement events
```

History records the event state, source, actor, timestamps, command ID, and reason. Routine unchanged heartbeats refresh the reported timestamp without filling the history. State fields and history are updated atomically in the same document. The document is initialized on the first state write; reading an uninitialized motor is read-only and reports unknown.

## Verification

All 17 backend tests pass. State-specific tests cover authentication, unknown defaults, requested versus reported state, device acknowledgement, stale data, invalid input, old command rejection, demo labels, history persistence, and unchanged heartbeats. A live local API check switched only the simulated AI-lab motor on and then back off, verifying the on-list and the saved Atlas document. No real hardware state was changed.
