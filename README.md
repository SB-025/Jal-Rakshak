# FlowRaksh

React (Vite) frontend and FastAPI backend with MongoDB Atlas storage.

## Start on Windows

Backend, in PowerShell:

```powershell
cd "C:\Jal Rakshak\backend"
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Frontend, in another PowerShell window:

```powershell
cd "C:\Jal Rakshak\frontend"
npm.cmd run dev
```

Frontend: http://localhost:5173. API documentation: http://127.0.0.1:8000/docs.

## MongoDB Atlas configuration

Edit `backend/.env` and set `MONGODB_URI` to your Atlas driver connection string. The username/password in that URI belong to your Atlas database user, independently of the application login. URL-encode special characters in the Atlas database password. Allow this computer's IP in Atlas Network Access and grant the database user read/write access to `jal_rakshak`. Restart the backend after changing `.env`.

`MONGODB_DB` defaults to `jal_rakshak`. Collections: `motors` and `readings`. A unique index prevents duplicate `motor_oid` values. A motor's MongoDB `id` is generated automatically; `motor_oid` is your external identifier.

The requested application account is configured in the local `.env`. Its password is stored as a salted PBKDF2 hash, and the JWT signing secret is generated locally. `.env` is ignored by Git. `.env.example` lists settings without secrets. Login tokens expire after one hour; send the returned token as `Authorization: Bearer <access_token>` on all motor and reading requests. In Swagger, call login, click **Authorize**, and paste the token.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | Username/password login, returns bearer token |
| POST | `/motors` | Register a motor |
| GET | `/motors?skip=0&limit=100` | List registered motors with total count |
| POST | `/readings` | Save one sensor reading for a registered motor |
| GET | `/motors/{motor_id}?skip=0&limit=100` | Motor fields, latest reading, and reading history |
| GET | `/health` | API and actual MongoDB connection status |

List and history results use pagination, with up to 500 entries per request. Increase `skip` until all entries have been fetched. Detail lookups accept the external `motor_oid` or the returned MongoDB `id`. External identifiers take precedence if they resemble a MongoDB ID. Creation returns HTTP 201; duplicate motor IDs return 409; unknown motors return 404; invalid data returns 422; database unavailability returns 503. `/health` returns `degraded` when MongoDB is unavailable.

Login body:

```json
{"username":"niox","password":"YOUR_CONFIGURED_PASSWORD"}
```

Motor body (`POST /motors`):

```json
{
  "motor_name": "Pump 1",
  "coordinates": {"latitude": 19.076, "longitude": 72.8777},
  "size": "5 HP",
  "motor_oid": "MOTOR-001"
}
```

Reading body (`POST /readings`):

```json
{
  "motor_id": "MOTOR-001",
  "voltage": 230,
  "waterflow": 40,
  "density": 1000,
  "temperature": 52,
  "environment_temperature": 30,
  "humidity": 65
}
```

Units: voltage in volts, waterflow in litres/minute, density in kg/m³, temperatures in °C, humidity in percent. Timestamps are recorded by the server in UTC. Readings cannot be saved before motor registration. Motor details always include the latest reading even when history pagination is used.

## Install or test

```powershell
cd "C:\Jal Rakshak\backend"
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
cd ..\frontend
npm.cmd ci
npm.cmd run build
```

API tests use an in-memory MongoDB test double, not Atlas. A real Atlas write/read verification requires a configured connection string. The frontend is a connected React + TypeScript operator workspace.


## FlowRaksh frontend

Routes:
- `/` — marketing homepage, architecture, technology, and mission.
- `/login` — operator login using the configured account.
- `/dashboard` — authenticated overview, trends, fleet condition, and recent alerts.
- `/dashboard/pumps` — search and filter pumps.
- `/dashboard/pumps/new` — register equipment through POST /motors.
- `/dashboard/pumps/:id` — sensor measurements, history, and manual reading entry.
- `/dashboard/diagnostics` — evidence from threshold rules; no ML score is fabricated.
- `/dashboard/alerts` — acknowledge, resolve, and reopen latest-reading events.
- `/dashboard/maintenance` — create inspection work orders and track their status.
- `/dashboard/reports` — download sensor, alert, and maintenance CSV reports.
- `/dashboard/settings` — configure thresholds and inspect connection information.

Append `?demo=1` to any dashboard route for a standalone simulated preview without login or API calls. Demo changes last only until the workspace is unmounted. The authenticated workspace loads MongoDB data; it never silently switches to fake data on a network failure. Sensor charts use recorded timestamps and the browser's local timezone. The API refreshes every 60 seconds, and the token is held in sessionStorage for the current browser tab. Tokens expire after one hour.

### Frontend configuration and checks

`frontend/.env.example` documents optional `VITE_API_URL`, defaulting to `http://127.0.0.1:8000`. To change it, copy the example to `frontend/.env`, edit the URL, and restart Vite. This value is public browser configuration; never place database credentials in a VITE_ variable.

```powershell
cd "C:\Jal Rakshak\frontend"
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

### Simulated Atlas records

`backend/seed_demo.py` posts three explicitly marked demo pumps, 24 historical readings per pump, and one simulated inspection work order through the running authenticated API. It preserves existing equipment and can be rerun without duplicating those sample readings. Run from backend with `.\.venv\Scripts\python.exe seed_demo.py` and enter the application password at the prompt. Optional `SEED_API_URL` selects another local API URL.

The seeded pumps are Worli intake, Dadar booster, and Bandra transfer. The Dadar scenario deliberately crosses the illustrative temperature and flow thresholds. Their source is always `demo`; no physical hardware is claimed to be online. Physical current, pressure, and vibration sensors are not connected. A successful rule evaluation is not a guarantee of health. Resolving an alert records operator action; the pump condition remains out of threshold while the measurement remains out of range.

Additional authenticated APIs:
- GET/POST `/settings` — read and save threshold configuration.
- GET/POST `/maintenance` — list and create work orders.
- PATCH `/maintenance/{work_id}` — update work-order status.
- GET/POST `/alert-actions` — store acknowledgement/resolution for an existing sensor event.

POST `/motors` and `/readings` support `source`: `demo`, `manual`, or `hardware`. Registering hardware does not prove connectivity. Reading timestamps can be supplied as timezone-aware `measured_at`; server receipt is retained as `received_at`. Future timestamps are rejected. A reading for a demo motor is always tagged demo.

### Connecting an ESP32-S3 next

1. Confirm and calibrate the installed sensors; the current API requires all six reading values. Do not send invented values for missing hardware. Evolve the API schema to optional fields before connecting a partial sensor set.
2. POST actual measurements over authenticated HTTP to `/readings`, using the motor's registered identifier and `source: hardware`. Keep credentials on a trusted gateway; the current operator login is intended for this prototype. Add per-device credentials before unattended hardware ingestion.
3. Compare received measurements with trusted reference readings and validate thresholds for the actual motor. MQTT transport is planned, not implemented.
4. Collect labelled normal/fault datasets, train a model, validate it on held-out operating data, and add an inference endpoint before showing anomaly scores or remaining-life predictions.

For a deployed frontend, configure the static host to serve `index.html` for application routes and configure backend CORS_ORIGINS to the actual frontend origin. This project is currently developed and verified locally.


## Project brief and visual system

The interface uses predominantly black-and-white controls and typography over a shared orange, white, and green blended background. Marketing headings use an editorial serif treatment and primary actions use black pill buttons. Charts use charcoal for temperature, orange for water flow, and muted green for voltage. Status badges retain explicit labels so colour is not the only indicator.

`/project` contains the reconstructed PS000128 working problem, proposed architecture, an 18-item implementation audit, and a pilot roadmap. The exact problem wording and Gujarat board attribution remain unverified. General challenge context is supported by https://sevafirst.mic.gov.in/ — water appears within the sustainability theme and the Open level describes a demonstrated prototype or pilot with a credible deployment pathway.

The present detection rules run in the browser against the latest stored reading. Backend incident generation, comprehensive archived incident history, ESP32-S3 firmware/heartbeat, validated anomaly ML, MQTT, and Ollama Cloud explanations are planned. Ollama is intended to explain established detection evidence, not decide faults independently. No AI integration was added as part of the visual redesign.

Visual reference: https://www.sarvam.ai/ — used for editorial hierarchy, centred hero composition, generous spacing, and blended backgrounds. FlowRaksh retains its own branding, product content, and software preview. The shared visual layer is in frontend/src/editorial-theme.css.


## AI diagnostician (implemented)

See AI-System-Guide.md for the current AI implementation, model boundaries, training format, and Ollama setup. The new authenticated page /dashboard/diagnostics runs backend rules, demo-trained Isolation Forest and Random Forest models, validated short-term trend projections, and optional Ollama Cloud explanations. Reports persist in MongoDB and can create inspection work orders.

The older roadmap above is superseded by this section: demo ML is now trained, backend on-demand screening is implemented, and the Ollama adapter is implemented and mock-tested. Live report-grounded Ollama chat has been verified; the key remains server-side. No damaged part is confirmed, no hardware-trained model is currently available, and ESP32-S3 firmware/transport remains to be connected. Demo models do not score hardware readings. The database includes an additional rich-sensor demo motor with 24 readings; the original records were preserved.

AI diagnosis UI update: the diagram and model-lab panels were removed. A report-grounded chat now explains the selected motor, with saved conversations and explicit local fallback when Ollama is unavailable. See AI-System-Guide.md for chat endpoints.


## Motor state APIs

GET /motor-states?state=on lists motors reported on. POST /motors/{motor_id}/state accepts {"state":"on"} or {"state":"off"} and persists a requested state plus recent history in motor_states. Hardware state remains pending until an authenticated device report arrives; demo state changes are explicitly simulated. The same POST accepts source=device and the returned command_id for acknowledgement. See Motor-State-API-Guide.md for the ESP32 polling/acknowledgement workflow, freshness handling, and database schema.
