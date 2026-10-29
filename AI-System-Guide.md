# FlowRaksh AI motor diagnostician

## Working implementation

Open `/dashboard/diagnostics` after signing in. Select a motor and click **Run diagnosis**. The server loads its latest 200 readings, evaluates configured rules and eligible local models, checks short-term trend projections, and saves the complete report in MongoDB's `diagnoses` collection. In the simplified UI, cloud explanations are requested conversationally through Ask FlowRaksh; refreshing the report itself runs the local assessment. The existing one-shot explanation API remains supported. Saved reports can be revisited and downloaded. The same page can create an inspection work order.

The standalone `?demo=1` browser preview does not call the authenticated AI APIs. Sign in to assess the simulated equipment stored in Atlas.

### Detection and prediction layers

| Layer | Implementation | Interpretation |
|---|---|---|
| Screening rules | Backend temperature/flow/voltage limits | Evidence for inspection, not a confirmed fault |
| Condition index | 100 minus rule penalties and anomaly penalty | Heuristic screening index; not health probability or remaining life |
| Anomaly model | scikit-learn Isolation Forest | Deviation from the learned normal baseline; negative decision scores are more unusual |
| Component model | scikit-learn Random Forest | Ranked component-pattern suggestions; tree votes are uncalibrated |
| Trend projection | Linear regression with chronological holdout | Up to 60 minutes after the last measurement, assuming recent conditions continue |
| Explanation | Ollama Cloud through the backend | Natural-language interpretation of supplied evidence, without authority to change the detection result |

The condition index subtracts 18 for each warning rule, 35 for each critical rule, and 10 for an anomaly-model flag, floored at zero. The demo vibration rule uses an illustrative 4.5 mm/s threshold only for simulated readings; it is not a manufacturer-certified limit. Actual equipment needs operating limits appropriate to its specification.

Component classes are normal, bearing/alignment, winding/electrical load, impeller/intake flow path, cooling/airflow, and power supply/wiring. No API response marks a damaged part as confirmed. Thermal or flow evidence can have multiple causes; additional sensors and inspection are necessary to distinguish them.

### Data and model boundaries

Demo models are trained on 1,440 generated, labelled examples across 72 synthetic motor groups. The generator deliberately encodes assumed component patterns. A group-separated split uses 960 examples from 48 groups for training and 480 examples from 24 other groups for holdout. This is a software demonstration, not a real fault dataset. Perfect classification on these separable synthetic scenarios is not evidence of field accuracy. The current demo Isolation Forest flags 12.5% of normal holdout examples, which also demonstrates why field validation is necessary.

The demo bundle can score only readings labelled `demo`. It cannot score `hardware` or `manual` readings. A separately trained hardware bundle is required for hardware predictions. No hardware model is presently trained.

The component classifier requires all nine input measurements. If vibration, current, or pressure is missing, classification is withheld. If the top model vote is below 0.55 or the margin over the next class is below 0.15, the model abstains. These are screening gates, not calibrated confidence guarantees. Rule evidence and anomaly results remain available when eligible.

Trend projection requires at least ten distinct timestamps over ten minutes. A chronological 25% holdout must have R² of at least 0.3 and MAE no greater than 5 °C for temperature or 8 L/min for flow. Unreliable projections are withheld. Projections refer to the latest stored measurement time, not necessarily the current time. They are not failure dates or remaining useful life predictions.

## Ollama Cloud configuration

Add these settings to `C:\Jal Rakshak\backend\.env`:

```dotenv
OLLAMA_API_KEY=your_private_key
OLLAMA_MODEL=gemma4:31b
```

The key stays on the backend and must never be placed in a `VITE_` variable. Restart the backend after changing environment configuration. The default cloud endpoint is `https://ollama.com/api/chat`. The model name is configurable; select a name currently supported by your Ollama account.

Only the report's numeric measurements, data-source label, triggered rules, supported component hypotheses, missing sensors, and limitations are sent to Ollama. Pump names, coordinates, login credentials, and the Atlas URI are excluded. The cloud response must cite existing evidence and component identifiers. Unknown references, malformed responses, unsupported definitive diagnoses, authentication errors, rate limits, network errors, and timeouts result in an explicit fallback. Local assessment continues to work.

Ollama Cloud's current documentation says structured output enforcement is unavailable. The implementation therefore requests JSON through the prompt and validates the response locally with Pydantic rather than relying on a `format` schema. A timeout bounds the request to 40 seconds. An LLM explanation remains an interpretation and can be wrong even after schema validation.

**Current verification:** the cloud adapter's success, invalid-output, and timeout paths have automated tests with mocked responses. Live report-grounded Ollama chat has also been verified using the simulated motor report, including a follow-up question and saved conversation history. This does not validate physical fault diagnosis.

Official references: [Ollama Cloud](https://docs.ollama.com/cloud), [chat endpoint](https://docs.ollama.com/api/chat), [structured-output support](https://docs.ollama.com/capabilities/structured-outputs), [Isolation Forest](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.IsolationForest.html).

## API endpoints

All endpoints require the existing login bearer token.

| Method | Path | Purpose |
|---|---|---|
| GET | `/diagnostics/status` | Cloud configuration and local model metadata |
| POST | `/models/train-demo` | Train and save demo-only models; body `{"demo_only":true}` |
| POST | `/motors/{motor_id}/diagnose` | Generate and save a report; body `{"use_cloud":true,"horizon_minutes":60}` |
| GET | `/motors/{motor_id}/diagnoses?skip=0&limit=20` | Paginated diagnostic report history |

Existing `POST /readings` now accepts optional `vibration_rms` (mm/s), `current` (A), and `pressure` (bar). Omit unavailable sensor values; do not fill them with zeros. The original six fields remain required. A reading saved against a demo motor is always labelled demo.

Example full-sensor ESP32/gateway payload:

```json
{
  "motor_id": "YOUR_REGISTERED_HARDWARE_MOTOR_OID",
  "source": "hardware",
  "voltage": 230,
  "waterflow": 40,
  "density": 998.2,
  "temperature": 52,
  "environment_temperature": 30,
  "humidity": 65,
  "vibration_rms": 1.5,
  "current": 5.1,
  "pressure": 2.8
}
```

Values above illustrate the request format; they are not measurements from actual hardware. Sending the payload stores telemetry. Diagnosis is currently operator-triggered; automatic background diagnosis or notification on every ESP32 reading is not implemented. Avoid sending every telemetry packet to an LLM.

## Run, train, and test on Windows

```powershell
cd "C:\Jal Rakshak\backend"
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

In another PowerShell window:

```powershell
cd "C:\Jal Rakshak\frontend"
npm.cmd run dev
```

Train/regenerate the demo models:

```powershell
cd "C:\Jal Rakshak\backend"
.\.venv\Scripts\python.exe model_service.py --demo
```

The optional `MODEL_DIR` setting selects the server's local model-artifact folder. Default: `backend/model_artifacts`. Artifacts are ignored by Git and must be regenerated or copied with a deployment. Only load server-controlled training artifacts; the API does not accept uploaded pickle/joblib files.

Tests:

```powershell
cd "C:\Jal Rakshak\backend"
.\.venv\Scripts\python.exe -m pytest -q
cd ..\frontend
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

The sample database now also contains `DEMO-AI-BEARING-04`, a fourth simulated motor with 24 rich-sensor readings. The original three motors and their 72 readings are preserved. The additional scenario has rising temperature and vibration; its model suggestion is deliberately a demo bearing/alignment pattern. Saved diagnoses record the source, measurements, exact model metadata, evidence, forecasts, cloud status, and report time.

## Training on genuine inspection-confirmed data

Export a CSV with the nine measurement columns plus:

```text
component_label,motor_group,data_source,inspection_confirmed
```

Use the class identifiers `normal`, `bearing`, `winding`, `impeller`, `cooling`, and `supply`. All real-data rows must have `data_source=hardware` and `inspection_confirmed=true`. `motor_group` identifies the physical motor so samples from the same motor do not leak across training and holdout. Include normal operation and at least one fault class, at least 40 examples from at least three independent motor groups per class, and at least 120 rows overall. These are software minimums, not a guarantee that the dataset is sufficient for deployment.

```powershell
cd "C:\Jal Rakshak\backend"
.\.venv\Scripts\python.exe model_service.py --csv "C:\path\confirmed-motor-data.csv"
```

This creates a separate experimental hardware bundle. Before operational use, validate across actual pump types, loads, sensor calibrations, environmental conditions, fault severities, and time periods. Evaluate false alarms and missed faults independently. Add inspection outcomes and confirmed component labels rather than treating AI suggestions as training truth.


## Simplified diagnosis and chat screen

The main AI diagnosis page now shows a concise motor snapshot beside a conversational screen. The motor diagram, model-training cards, validation statistics, and detailed model mathematics were removed from this page. Forecasts and older reports remain under collapsed report sections. Model training remains available through the existing API and command-line tools.

Ask questions such as “What happened?”, “Which part should I inspect?”, “What should I do next?”, or “Is temperature getting worse?”. Each saved report has its own conversation. The backend supplies that report's sensor evidence and the latest six exchanges to Ollama. It does not accept client-supplied system messages or arbitrary chat history. Pump names and coordinates are excluded from the model's report context.

When Ollama is not configured, times out, or returns an invalid response, a clearly labelled local answer explains the saved report. It is not presented as a cloud-generated answer. Component suggestions still require inspection. The UI displays the latest 30 exchanges; all exchanges remain saved in the diagnostic_chats collection.

Additional authenticated endpoints:
- POST /motors/{motor_id}/chat — body {"message":"What happened?","report_id":"REPORT_OBJECT_ID"}.
- GET /motors/{motor_id}/chat?report_id=REPORT_OBJECT_ID — retrieve conversation for that motor and report.

Reports are validated against the motor before a conversation can be read or written. Questions are limited to 2,000 characters, and cloud answers are validated against known evidence identifiers. Tests cover report scoping, persistence, authentication, cloud context and response checks, missing configuration, and timeout fallback.
