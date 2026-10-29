import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  Check,
  CircleCheck,
  Clock3,
  Download,
  Droplets,
  FileText,
  Gauge,
  LoaderCircle,
  MapPin,
  Plus,
  Radio,
  Search,
  Settings2,
  ShieldCheck,
  Thermometer,
  TriangleAlert,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { API_BASE } from "./api";
import { useData } from "./data";
import MotorPowerSwitch from "./MotorPowerSwitch";
import {
  ago,
  Badge,
  Empty,
  formatDate,
  PageHeading,
  PanelHeading,
  Status,
  TrendChart,
  useClock,
} from "./components";
import type { Alert, Pump, Thresholds, WorkOrder } from "./types";
const measurements = [
  {
    key: "temperature",
    name: "Motor temperature",
    unit: "°C",
    Icon: Thermometer,
  },
  { key: "waterflow", name: "Water flow", unit: "L/min", Icon: Droplets },
  { key: "voltage", name: "Voltage", unit: "V", Icon: Zap },
  { key: "density", name: "Density", unit: "kg/m³", Icon: Gauge },
  {
    key: "environment_temperature",
    name: "Ambient temperature",
    unit: "°C",
    Icon: Thermometer,
  },
  { key: "humidity", name: "Humidity", unit: "%", Icon: Droplets },
] as const;
const optionalMeasurements = [
  { key: "vibration_rms", name: "Vibration RMS", unit: "mm/s", Icon: Activity },
  { key: "current", name: "Electrical current", unit: "A", Icon: Zap },
  { key: "pressure", name: "Discharge pressure", unit: "bar", Icon: Gauge },
] as const;
function useModalFocus(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement;
    const modal = document.querySelector<HTMLElement>("[role=dialog]");
    const focusable = () =>
      Array.from(
        modal?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input, select, textarea, a[href]",
        ) || [],
      );
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
      if (event.key === "Tab") {
        const list = focusable(),
          first = list[0],
          last = list.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, close]);
}
function useSuffix() {
  return useData().demo ? "?demo=1" : "";
}
function getState(pump: Pump, alerts: Alert[]) {
  const relevant = alerts.filter((a) => a.pump.id === pump.id);
  return relevant.some((a) => a.severity === "critical")
    ? "critical"
    : relevant.length
      ? "warning"
      : pump.latest_reading
        ? "normal"
        : "unknown";
}
function PumpCard({ pump }: { pump: Pump }) {
  const suffix = useSuffix(),
    { alerts } = useData(),
    state = getState(pump, alerts);
  return (
    <article className="pump-card">
      <Link
        className="pump-card-main"
        to={`/dashboard/pumps/${pump.id}${suffix}`}
      >
        <div className="pump-card-top">
          <span className={`pump-icon ${state}`}>
            <Droplets size={22} />
          </span>
          <Status pump={pump} />
        </div>
        <span className="tiny-label">{pump.motor_oid}</span>
        <h3>{pump.motor_name}</h3>
        <p>
          <MapPin size={12} />
          {pump.coordinates.latitude.toFixed(4)}° N,{" "}
          {pump.coordinates.longitude.toFixed(4)}° E <span>· {pump.size}</span>
        </p>
        <div className="pump-sensor-row">
          <div>
            <small>TEMPERATURE</small>
            <strong>
              {pump.latest_reading?.temperature ?? "—"} <span>°C</span>
            </strong>
          </div>
          <div>
            <small>WATER FLOW</small>
            <strong>
              {pump.latest_reading?.waterflow ?? "—"} <span>L/min</span>
            </strong>
          </div>
        </div>
        <div className="pump-card-footer">
          <Badge
            tone={
              state === "normal"
                ? "success"
                : state === "unknown"
                  ? "muted"
                  : state
            }
          >
            {state === "normal"
              ? "Within thresholds"
              : state === "unknown"
                ? "Awaiting data"
                : `${state} · inspect`}
          </Badge>
          <ArrowUpRight size={16} />
        </div>
      </Link>
      <MotorPowerSwitch pump={pump} compact />
    </article>
  );
}
export function Dashboard() {
  const { pumps, alerts, maintenance, demo } = useData(),
    suffix = useSuffix();
  const [metric, setMetric] = useState<"temperature" | "waterflow" | "voltage">(
    "temperature",
  );
  const [selected, setSelected] = useState("");
  const selectedPump = pumps.find((p) => p.id === selected) || pumps[0];
  const active = alerts.filter((a) => a.status !== "resolved");
  const now = useClock();
  const recentHardware = pumps.filter(
    (p) =>
      p.source === "hardware" &&
      p.latest_reading &&
      now - new Date(p.latest_reading.recorded_at).getTime() < 300000,
  ).length;
  const normal = pumps.filter((p) => getState(p, alerts) === "normal").length;
  return (
    <>
      <PageHeading
        eyebrow="YOUR INFRASTRUCTURE, IN FOCUS"
        title="Operations overview"
        description="A clearer view of your pumps. A head start on what’s next."
        action={
          <Link
            className="button button-small"
            to={`/dashboard/pumps/new${suffix}`}
          >
            <Plus size={16} /> Register pump
          </Link>
        }
      />
      <div className="stat-grid">
        {[
          [
            Droplets,
            "Registered pumps",
            pumps.length,
            `${pumps.filter((p) => p.source === "demo").length} simulated · ${pumps.filter((p) => p.source !== "demo").length} other`,
          ],
          [
            Radio,
            "Reporting hardware",
            recentHardware,
            "Hardware readings received within 5 min",
          ],
          [
            TriangleAlert,
            "Needs attention",
            active.length,
            "Open or acknowledged threshold events",
          ],
          [
            Wrench,
            "Open work orders",
            maintenance.filter((m) => m.status !== "completed").length,
            "Scheduled and in progress",
          ],
        ].map(([Icon, label, value, note]) => {
          const I = Icon as typeof Droplets;
          return (
            <div className="stat-card" key={String(label)}>
              <div>
                <span>{String(label)}</span>
                <I size={18} />
              </div>
              <strong>{String(value).padStart(2, "0")}</strong>
              <small>{String(note)}</small>
            </div>
          );
        })}
      </div>
      <div className="overview-grid">
        <section className="panel trend-panel">
          <PanelHeading
            title="Sensor trends"
            subtitle={
              selectedPump
                ? `${selectedPump.motor_name} · ${selectedPump.source === "demo" ? "simulated history" : "recorded history"}`
                : "No pump selected"
            }
            action={
              <select
                aria-label="Select pump for chart"
                value={selectedPump?.id || ""}
                onChange={(e) => setSelected(e.target.value)}
              >
                {pumps.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.motor_name}
                  </option>
                ))}
              </select>
            }
          />
          <div className="chart-tabs">
            {(["temperature", "waterflow", "voltage"] as const).map((m) => (
              <button
                className={m === metric ? "selected" : ""}
                key={m}
                onClick={() => setMetric(m)}
              >
                {m === "temperature"
                  ? "Temperature"
                  : m === "waterflow"
                    ? "Water flow"
                    : "Voltage"}
              </button>
            ))}
            <span>
              <span className="live-dot" />
              {demo ? "SIMULATED DATA" : "STORED READINGS"}
            </span>
          </div>
          <TrendChart readings={selectedPump?.readings || []} metric={metric} />
          <div className="chart-bottom">
            <span>Recorded history · local time</span>
            <Link
              to={
                selectedPump
                  ? `/dashboard/pumps/${selectedPump.id}${suffix}`
                  : `/dashboard/pumps${suffix}`
              }
            >
              View details <ArrowRight size={12} />
            </Link>
          </div>
        </section>
        <section className="panel health-panel">
          <PanelHeading
            title="Fleet condition"
            subtitle="Based on configured thresholds"
          />
          <div
            className="health-ring"
            style={
              {
                "--health": `${pumps.length ? (normal / pumps.length) * 100 : 0}%`,
              } as React.CSSProperties
            }
          >
            <div>
              <strong>
                {normal}
                <small>/{pumps.length}</small>
              </strong>
              <span>within thresholds</span>
            </div>
          </div>
          <div className="health-legend">
            <span>
              <i className="dot teal" />
              Normal <b>{normal}</b>
            </span>
            <span>
              <i className="dot amber" />
              Warning{" "}
              <b>
                {pumps.filter((p) => getState(p, alerts) === "warning").length}
              </b>
            </span>
            <span>
              <i className="dot red" />
              Critical{" "}
              <b>
                {pumps.filter((p) => getState(p, alerts) === "critical").length}
              </b>
            </span>
            <span>
              <i className="dot gray" />
              No data <b>{pumps.filter((p) => !p.latest_reading).length}</b>
            </span>
          </div>
          <p className="small-note">
            Threshold status is an operating signal, not a validated health
            prediction.
          </p>
        </section>
      </div>
      <div className="section-row">
        <div>
          <h2>Pump stations</h2>
          <p>Equipment status at a glance</p>
        </div>
        <Link className="text-link" to={`/dashboard/pumps${suffix}`}>
          View all pumps <ArrowRight size={14} />
        </Link>
      </div>
      {pumps.length ? (
        <div className="pump-grid">
          {pumps.slice(0, 3).map((p) => (
            <PumpCard key={p.id} pump={p} />
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty title="Your fleet starts here">
            <p>Register a motor, then post its first sensor reading.</p>
            <Link className="button" to={`/dashboard/pumps/new${suffix}`}>
              Register your first pump <Plus size={15} />
            </Link>
          </Empty>
        </div>
      )}
      <div className="overview-bottom">
        <section className="panel">
          <PanelHeading
            title="Recent alerts"
            subtitle="Latest threshold events requiring attention"
            action={
              <Link className="text-link" to={`/dashboard/alerts${suffix}`}>
                All alerts <ArrowUpRight size={14} />
              </Link>
            }
          />
          {active.length ? (
            active.slice(0, 3).map((a) => (
              <Link
                className="alert-summary"
                key={a.id}
                to={`/dashboard/alerts${suffix}`}
              >
                <span className={`alert-icon ${a.severity}`}>
                  <TriangleAlert size={18} />
                </span>
                <div>
                  <strong>{a.title}</strong>
                  <p>
                    {a.pump.motor_name} · {a.evidence}
                  </p>
                </div>
                <span>{ago(a.timestamp)}</span>
              </Link>
            ))
          ) : (
            <div className="quiet-state">
              <CircleCheck size={23} />
              <span>No open threshold alerts</span>
            </div>
          )}
        </section>
        <section className="panel connection-panel">
          <PanelHeading
            title="Connection overview"
            subtitle="Data provenance, without guesswork"
          />
          {[
            [
              "Simulated pumps",
              pumps.filter((p) => p.source === "demo").length,
            ],
            [
              "Manual registrations",
              pumps.filter((p) => p.source === "manual").length,
            ],
            [
              "Hardware registrations",
              pumps.filter((p) => p.source === "hardware").length,
            ],
          ].map(([label, n]) => (
            <div key={String(label)}>
              <span>{label}</span>
              <b>{n}</b>
            </div>
          ))}
          <p className="small-note">
            <Radio size={14} /> ESP32-S3 transport is not connected by this app.
            Recent data does not confirm a live device connection.
          </p>
        </section>
      </div>
    </>
  );
}
export function PumpsPage() {
  const { pumps } = useData(),
    suffix = useSuffix();
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  const filtered = pumps.filter(
    (p) =>
      `${p.motor_name} ${p.motor_oid}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "all" || p.source === filter),
  );
  return (
    <>
      <PageHeading
        title="Pump monitoring"
        description="Your registered stations, sensor signals, and operating history."
        action={
          <Link
            className="button button-small"
            to={`/dashboard/pumps/new${suffix}`}
          >
            <Plus size={16} /> Register pump
          </Link>
        }
      />
      <div className="toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search pumps"
            placeholder="Search pump name or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter data source"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All sources</option>
          <option value="demo">Simulated</option>
          <option value="manual">Manual</option>
          <option value="hardware">Hardware</option>
        </select>
        <span>{filtered.length} pumps</span>
      </div>
      {filtered.length ? (
        <div className="pump-grid">
          {filtered.map((p) => (
            <PumpCard key={p.id} pump={p} />
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty title={search ? "No matching pumps" : "No pumps registered"}>
            <p>
              {search
                ? "Try another name or source filter."
                : "Add your first motor to start collecting readings."}
            </p>
          </Empty>
        </div>
      )}
    </>
  );
}

export function MotorForm() {
  const { createMotor, demo } = useData(),
    navigate = useNavigate(),
    suffix = useSuffix();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const result = await createMotor({
        motor_name: f.get("motor_name"),
        motor_oid: f.get("motor_oid"),
        size: f.get("size"),
        coordinates: {
          latitude: Number(f.get("latitude")),
          longitude: Number(f.get("longitude")),
        },
        source: f.get("source"),
      });
      navigate(`/dashboard/pumps/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save motor");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" to={`/dashboard/pumps${suffix}`}>
        <ArrowLeft size={14} /> Pump monitoring
      </Link>
      <PageHeading
        title="Register a pump"
        description="Give your equipment a place in the operating picture."
      />
      <div className="form-layout">
        <form className="panel form-panel" onSubmit={submit}>
          <PanelHeading
            title="Equipment details"
            subtitle="All fields are required. Registration does not connect hardware."
          />
          <label>
            Pump name
            <input
              name="motor_name"
              required
              maxLength={120}
              placeholder="e.g. Worli intake pump"
            />
          </label>
          <div className="form-grid">
            <label>
              Unique motor OID
              <input
                name="motor_oid"
                required
                maxLength={100}
                placeholder="PUMP-001"
              />
            </label>
            <label>
              Motor size
              <input
                name="size"
                required
                maxLength={100}
                placeholder="e.g. 5 HP"
              />
            </label>
            <label>
              Latitude
              <input
                name="latitude"
                type="number"
                min={-90}
                max={90}
                step="any"
                required
                placeholder="19.0176"
              />
            </label>
            <label>
              Longitude
              <input
                name="longitude"
                type="number"
                min={-180}
                max={180}
                step="any"
                required
                placeholder="72.8162"
              />
            </label>
          </div>
          <label>
            Data source
            <select name="source">
              <option value="manual">Manual data entry</option>
              <option value="hardware">Hardware integration</option>
              <option value="demo">Simulated demonstration</option>
            </select>
          </label>
          {demo && (
            <div className="notice">
              Demo workspace is read-only for pump registration.{" "}
              <Link to="/login">Sign in to save to MongoDB.</Link>
            </div>
          )}
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          <div className="form-actions">
            <Link
              className="button button-outline"
              to={`/dashboard/pumps${suffix}`}
            >
              Cancel
            </Link>
            <button className="button" disabled={busy || demo}>
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Plus size={16} />
              )}{" "}
              Register pump
            </button>
          </div>
        </form>
        <aside className="panel help-panel">
          <ShieldCheck size={26} />
          <h3>A reliable record from day one.</h3>
          <p>
            The external motor OID must be unique. Sensor readings can reference
            this OID or the generated database ID.
          </p>
          <hr />
          <h4>Next step</h4>
          <p>
            Add a manual reading or send authenticated sensor data to{" "}
            <code>POST /readings</code>.
          </p>
          <p>
            Registering hardware does not establish connectivity. The interface
            reports the time of the latest received data.
          </p>
        </aside>
      </div>
    </>
  );
}

export function MotorDetail() {
  const { id } = useParams(),
    { pumps, addReading, demo } = useData(),
    suffix = useSuffix();
  const pump = pumps.find((p) => p.id === id);
  const [metric, setMetric] = useState<"temperature" | "waterflow" | "voltage">(
      "temperature",
    ),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  useModalFocus(
    show,
    useCallback(() => {
      if (!busy) setShow(false);
    }, [busy]),
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      motor_id: id,
      source: pump?.source === "demo" ? "demo" : "manual",
    };
    measurements.forEach((m) => (body[m.key] = Number(f.get(m.key))));
    optionalMeasurements.forEach((m) => {
      const raw = f.get(m.key);
      if (typeof raw === "string" && raw.trim()) body[m.key] = Number(raw);
    });
    try {
      await addReading(body);
      setSuccess("Sensor reading saved to MongoDB.");
      setShow(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save reading");
    } finally {
      setBusy(false);
    }
  }
  if (!pump)
    return (
      <Empty title="Pump not found">
        <Link to={`/dashboard/pumps${suffix}`}>Back to pumps</Link>
      </Empty>
    );
  return (
    <>
      <Link className="back-link" to={`/dashboard/pumps${suffix}`}>
        <ArrowLeft size={14} /> All pumps
      </Link>
      <PageHeading
        eyebrow={pump.motor_oid}
        title={pump.motor_name}
        description={`${pump.size} · ${pump.coordinates.latitude}° N, ${pump.coordinates.longitude}° E`}
        action={
          <button
            className="button button-small"
            onClick={() => {
              setShow(true);
              setError("");
            }}
            disabled={demo}
          >
            <Plus size={16} /> Add reading
          </button>
        }
      />
      <MotorPowerSwitch pump={pump} />
      <div className="detail-status">
        <Status pump={pump} />
        <span>
          <Clock3 size={14} /> Last reading:{" "}
          {formatDate(pump.latest_reading?.recorded_at)}
        </span>
        <span>{pump.total_readings} recorded readings</span>
        <span>
          Source: {pump.source === "demo" ? "simulated" : pump.source}
        </span>
      </div>
      {success && (
        <div className="success-box" role="status">
          <Check size={16} />
          {success}
        </div>
      )}
      <div className="sensor-grid">
        {[...measurements, ...optionalMeasurements].map(
          ({ key, name, unit, Icon }) => (
            <div className="panel sensor-card" key={key}>
              <span>
                <Icon size={18} />
                {name}
              </span>
              <strong>
                {pump.latest_reading?.[key] ?? "—"} <small>{unit}</small>
              </strong>
              <p>
                {pump.latest_reading?.[key] != null
                  ? `${pump.latest_reading.source || pump.source} reading`
                  : "Not connected"}
              </p>
            </div>
          ),
        )}
      </div>
      <section className="panel">
        <PanelHeading
          title="Operating history"
          subtitle={`${pump.total_readings} stored readings · timestamps in local time`}
          action={
            <select
              value={metric}
              aria-label="Chart measurement"
              onChange={(e) => setMetric(e.target.value as typeof metric)}
            >
              <option value="temperature">Temperature (°C)</option>
              <option value="waterflow">Water flow (L/min)</option>
              <option value="voltage">Voltage (V)</option>
            </select>
          }
        />
        <TrendChart readings={pump.readings} metric={metric} height={280} />
      </section>
      <div className="detail-bottom">
        <section className="panel">
          <PanelHeading
            title="Sensor availability"
            subtitle="Only supported measurements are displayed"
          />
          <div className="availability-list">
            {optionalMeasurements.map((sensor) => (
              <div key={sensor.key}>
                <span>{sensor.name}</span>
                <Badge
                  tone={
                    pump.latest_reading?.[sensor.key] != null
                      ? "success"
                      : "muted"
                  }
                >
                  {pump.latest_reading?.[sensor.key] != null
                    ? "Reading received"
                    : "Not connected"}
                </Badge>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <PanelHeading title="Equipment record" />
          <dl className="record-list">
            <dt>Motor OID</dt>
            <dd>{pump.motor_oid}</dd>
            <dt>Database ID</dt>
            <dd className="mono">{pump.id}</dd>
            <dt>Registered</dt>
            <dd>{formatDate(pump.created_at)}</dd>
            <dt>Hardware controller</dt>
            <dd>ESP32-S3 · integration pending</dd>
          </dl>
        </section>
      </div>
      <section className="panel">
        <PanelHeading
          title="Recent measurements"
          subtitle="Latest 20 rows. Download full loaded history from Reports."
        />
        {pump.readings.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Recorded at</th>
                  <th>Temperature</th>
                  <th>Flow</th>
                  <th>Voltage</th>
                  <th>Humidity</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {pump.readings.slice(0, 20).map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.recorded_at)}</td>
                    <td>{r.temperature} °C</td>
                    <td>{r.waterflow} L/min</td>
                    <td>{r.voltage} V</td>
                    <td>{r.humidity}%</td>
                    <td>{r.source || pump.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Waiting for the first reading" />
        )}
      </section>
      {show && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!busy) setShow(false);
          }}
        >
          <section
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-label="Add sensor reading"
            onClick={(e) => e.stopPropagation()}
          >
            <PanelHeading
              title="Add sensor reading"
              subtitle="Manually submitted values are not live hardware data."
              action={
                <button
                  className="icon-button"
                  aria-label="Close form"
                  onClick={() => setShow(false)}
                  disabled={busy}
                >
                  <X size={18} />
                </button>
              }
            />
            <form onSubmit={submit}>
              <div className="form-grid">
                {measurements.map((m) => (
                  <label key={m.key}>
                    {m.name} ({m.unit})
                    <input
                      autoFocus={m.key === "temperature"}
                      type="number"
                      step="any"
                      min={m.key.includes("temperature") ? -273.15 : 0}
                      max={m.key === "humidity" ? 100 : undefined}
                      name={m.key}
                      required
                    />
                  </label>
                ))}
              </div>
              <p className="small-note" style={{ marginBottom: 16 }}>
                Optional sensors: leave blank when not installed. Component
                classification requires all three.
              </p>
              <div className="form-grid">
                {optionalMeasurements.map((m) => (
                  <label key={m.key}>
                    {m.name} ({m.unit}) · optional
                    <input type="number" name={m.key} min={0} step="any" />
                  </label>
                ))}
              </div>
              {error && (
                <div className="error-box" role="alert">
                  {error}
                </div>
              )}
              <div className="form-actions">
                <button className="button" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <Plus size={15} />
                  )}{" "}
                  Save reading
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

export function AlertsPage() {
  const { alerts, setAlert } = useData(),
    suffix = useSuffix();
  const [filter, setFilter] = useState("all"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  const filtered = alerts.filter(
    (a) => filter === "all" || a.status === filter,
  );
  async function act(alert: Alert, status: string) {
    setBusy(alert.id);
    setError("");
    try {
      await setAlert(alert, status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update alert");
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <PageHeading
        title="Alerts & attention"
        description="Understand the evidence. Record the next step."
      />
      <div className="toolbar">
        <div className="filter-tabs">
          {["all", "open", "acknowledged", "resolved"].map((f) => (
            <button
              className={filter === f ? "selected" : ""}
              key={f}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <span>{filtered.length} latest-reading events</span>
      </div>
      <div className="notice">
        Alerts are evaluated from each pump’s latest reading. Acknowledgement
        and resolution are saved; older sensor history is available in Reports.
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {filtered.length ? (
        <div className="alerts-list">
          {filtered.map((a) => (
            <article className="panel alert-detail" key={a.id}>
              <span className={`alert-icon ${a.severity}`}>
                <TriangleAlert size={21} />
              </span>
              <div className="alert-detail-content">
                <div>
                  <Badge tone={a.severity}>{a.severity}</Badge>
                  <Badge tone={a.status === "resolved" ? "success" : "muted"}>
                    {a.status}
                  </Badge>
                  {a.pump.source === "demo" && (
                    <Badge tone="demo">Simulated</Badge>
                  )}
                </div>
                <h3>{a.title}</h3>
                <Link to={`/dashboard/pumps/${a.pump.id}${suffix}`}>
                  {a.pump.motor_name} <ArrowUpRight size={12} />
                </Link>
                <p>
                  <strong>Evidence:</strong> {a.evidence}
                </p>
                <p>
                  <strong>Recommended:</strong> {a.recommendation}
                </p>
                <small>{formatDate(a.timestamp)}</small>
              </div>
              <div className="alert-actions">
                {a.status === "open" && (
                  <button
                    className="button button-outline button-small"
                    disabled={busy === a.id}
                    onClick={() => void act(a, "acknowledged")}
                  >
                    Acknowledge
                  </button>
                )}
                {a.status !== "resolved" && (
                  <button
                    className="button button-small"
                    disabled={busy === a.id}
                    onClick={() => void act(a, "resolved")}
                  >
                    <Check size={14} /> Resolve
                  </button>
                )}
                {a.status === "resolved" && (
                  <button
                    className="button button-outline button-small"
                    disabled={busy === a.id}
                    onClick={() => void act(a, "open")}
                  >
                    Reopen
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty title="No alerts in this view">
            <p>
              Threshold events will appear here when the latest readings trigger
              a configured rule.
            </p>
          </Empty>
        </div>
      )}
    </>
  );
}

export function MaintenancePage() {
  const { pumps, maintenance, createWork, updateWork, demo } = useData();
  const [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("all");
  useModalFocus(
    show,
    useCallback(() => {
      if (!busy) setShow(false);
    }, [busy]),
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await createWork({
        motor_id: String(f.get("motor_id")),
        title: String(f.get("title")),
        notes: String(f.get("notes")),
        scheduled_date: String(f.get("scheduled_date")),
        status: "scheduled",
      });
      setShow(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save work order",
      );
    } finally {
      setBusy(false);
    }
  }
  async function update(id: string, status: WorkOrder["status"]) {
    setError("");
    try {
      await updateWork(id, status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
    }
  }
  return (
    <>
      <PageHeading
        title="Maintenance workspace"
        description="Turn an operating signal into a documented action."
        action={
          <button
            className="button button-small"
            disabled={!pumps.length}
            onClick={() => setShow(true)}
          >
            <Plus size={16} /> New work order
          </button>
        }
      />
      <div className="toolbar">
        <div className="filter-tabs">
          {["all", "scheduled", "in_progress", "completed"].map((f) => (
            <button
              className={filter === f ? "selected" : ""}
              key={f}
              onClick={() => setFilter(f)}
            >
              {f.replace("_", " ")}
            </button>
          ))}
        </div>
        <span>{demo ? "Session-only demo records" : "Saved in MongoDB"}</span>
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {maintenance.filter((w) => filter === "all" || w.status === filter)
        .length ? (
        <div className="work-grid">
          {maintenance
            .filter((w) => filter === "all" || w.status === filter)
            .map((w) => (
              <article className="panel work-card" key={w.id}>
                <div>
                  <span className="work-icon">
                    <Wrench size={20} />
                  </span>
                  <Badge tone={w.status === "completed" ? "success" : "demo"}>
                    {w.status.replace("_", " ")}
                  </Badge>
                </div>
                <h3>{w.title}</h3>
                <p>
                  {pumps.find((p) => p.id === w.motor_id)?.motor_name ||
                    "Unknown motor"}
                </p>
                <div className="work-notes">
                  {w.notes || "No inspection notes added."}
                </div>
                <span className="work-date">
                  <Clock3 size={14} /> Scheduled {w.scheduled_date}
                </span>
                <label>
                  Work-order status
                  <select
                    value={w.status}
                    onChange={(e) =>
                      void update(w.id, e.target.value as WorkOrder["status"])
                    }
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
              </article>
            ))}
        </div>
      ) : (
        <div className="panel">
          <Empty title="No work orders in this view">
            <p>
              Schedule an inspection or record a maintenance action for a
              registered pump.
            </p>
          </Empty>
        </div>
      )}
      {show && (
        <div className="modal-backdrop">
          <section
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-label="Create work order"
          >
            <PanelHeading
              title="Create work order"
              subtitle={
                demo
                  ? "Demo record · saved for this session only"
                  : "Record will be saved to MongoDB"
              }
              action={
                <button
                  className="icon-button"
                  aria-label="Close work order"
                  onClick={() => setShow(false)}
                  disabled={busy}
                >
                  <X size={18} />
                </button>
              }
            />
            <form onSubmit={submit}>
              <label>
                Inspection title
                <input
                  autoFocus
                  name="title"
                  required
                  maxLength={200}
                  placeholder="e.g. Inspect inlet filter"
                />
              </label>
              <div className="form-grid">
                <label>
                  Pump
                  <select name="motor_id" required>
                    {pumps.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.motor_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Scheduled inspection
                  <input name="scheduled_date" type="date" required />
                </label>
              </div>
              <label>
                Inspection notes
                <textarea
                  name="notes"
                  rows={4}
                  maxLength={3000}
                  placeholder="Record supporting evidence and the inspection to perform…"
                />
              </label>
              {error && (
                <div className="error-box" role="alert">
                  {error}
                </div>
              )}
              <div className="form-actions">
                <button className="button" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <Plus size={15} />
                  )}{" "}
                  Save work order
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

function download(name: string, rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const blob = new Blob(
    ["\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export function Reports() {
  const { pumps, alerts, maintenance } = useData();
  const [selected, setSelected] = useState("all");
  const filtered = pumps.filter((p) => selected === "all" || p.id === selected);
  const count = filtered.reduce((n, p) => n + p.readings.length, 0);
  function exportReadings() {
    download("flowraksh-sensor-history.csv", [
      [
        "Pump",
        "Motor OID",
        "Source",
        "Recorded at (UTC)",
        "Temperature (C)",
        "Flow (L/min)",
        "Voltage (V)",
        "Density (kg/m3)",
        "Ambient temp (C)",
        "Humidity (%)",
        "Vibration RMS (mm/s)",
        "Current (A)",
        "Pressure (bar)",
      ],
      ...filtered.flatMap((p) =>
        p.readings.map((r) => [
          p.motor_name,
          p.motor_oid,
          r.source || p.source,
          r.recorded_at,
          r.temperature,
          r.waterflow,
          r.voltage,
          r.density,
          r.environment_temperature,
          r.humidity,
          r.vibration_rms ?? "",
          r.current ?? "",
          r.pressure ?? "",
        ]),
      ),
    ]);
  }
  return (
    <>
      <PageHeading
        title="Reports & operating history"
        description="Trace the signals. Share the evidence."
        action={
          <button
            className="button button-small"
            onClick={exportReadings}
            disabled={!count}
          >
            <Download size={16} /> Export sensor history
          </button>
        }
      />
      <div className="toolbar">
        <select
          aria-label="Report pump filter"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="all">All pump stations</option>
          {pumps.map((p) => (
            <option key={p.id} value={p.id}>
              {p.motor_name}
            </option>
          ))}
        </select>
        <span>{count} readings available for export</span>
      </div>
      <div className="report-grid">
        <section className="panel report-card">
          <span className="form-icon">
            <Activity size={23} />
          </span>
          <h3>Sensor history</h3>
          <p>
            All loaded readings for the selected pumps, including timestamps,
            units, and data provenance.
          </p>
          <strong>
            {count} <small>records</small>
          </strong>
          <button
            className="button button-outline full"
            onClick={exportReadings}
            disabled={!count}
          >
            <Download size={15} /> Download CSV
          </button>
        </section>
        <section className="panel report-card">
          <span className="form-icon">
            <BellRing size={23} />
          </span>
          <h3>Threshold event summary</h3>
          <p>
            Latest-reading rule evaluations with severity, sensor evidence, and
            acknowledgement status.
          </p>
          <strong>
            {
              alerts.filter((a) => selected === "all" || a.pump.id === selected)
                .length
            }{" "}
            <small>events</small>
          </strong>
          <button
            className="button button-outline full"
            disabled={!alerts.length}
            onClick={() =>
              download("flowraksh-alerts.csv", [
                [
                  "Pump",
                  "Source",
                  "Severity",
                  "Event",
                  "Evidence",
                  "Timestamp",
                  "Status",
                ],
                ...alerts
                  .filter((a) => selected === "all" || a.pump.id === selected)
                  .map((a) => [
                    a.pump.motor_name,
                    a.pump.source,
                    a.severity,
                    a.title,
                    a.evidence,
                    a.timestamp,
                    a.status,
                  ]),
              ])
            }
          >
            <Download size={15} /> Download CSV
          </button>
        </section>
        <section className="panel report-card">
          <span className="form-icon">
            <FileText size={23} />
          </span>
          <h3>Maintenance register</h3>
          <p>
            Work orders, inspection notes, scheduled dates, and progress. A
            practical record of operator actions.
          </p>
          <strong>
            {
              maintenance.filter(
                (w) => selected === "all" || w.motor_id === selected,
              ).length
            }{" "}
            <small>work orders</small>
          </strong>
          <button
            className="button button-outline full"
            disabled={!maintenance.length}
            onClick={() =>
              download("flowraksh-maintenance.csv", [
                ["Pump", "Title", "Notes", "Scheduled date", "Status"],
                ...maintenance
                  .filter((w) => selected === "all" || w.motor_id === selected)
                  .map((w) => [
                    pumps.find((p) => p.id === w.motor_id)?.motor_name ||
                      w.motor_id,
                    w.title,
                    w.notes,
                    w.scheduled_date,
                    w.status,
                  ]),
              ])
            }
          >
            <Download size={15} /> Download CSV
          </button>
        </section>
      </div>
      {filtered[0] && (
        <section className="panel">
          <PanelHeading
            title="Temperature history"
            subtitle={`${filtered[0].motor_name} · ${filtered[0].source === "demo" ? "simulated data" : "recorded data"}`}
          />
          <TrendChart readings={filtered[0].readings} height={260} />
        </section>
      )}
      <div className="notice">
        <ShieldCheck size={16} /> Reports reflect stored or explicitly simulated
        measurements. They do not certify equipment health or predict a failure
        date.
      </div>
    </>
  );
}

export function SettingsPage() {
  const { thresholds, saveSettings, demo, pumps } = useData();
  const [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    const f = new FormData(e.currentTarget);
    const next = Object.fromEntries(
      Object.keys(thresholds).map((key) => [key, Number(f.get(key))]),
    ) as unknown as Thresholds;
    if (
      next.temperature_critical <= next.temperature_warning ||
      next.voltage_maximum <= next.voltage_minimum
    ) {
      setError(
        "Critical temperature must exceed warning temperature; maximum voltage must exceed minimum.",
      );
      setBusy(false);
      return;
    }
    try {
      await saveSettings(next);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Workspace settings"
        description="Configure the rules. Understand the connection."
      />
      <div className="settings-grid">
        <form className="panel form-panel" onSubmit={submit}>
          <PanelHeading
            title="Operating thresholds"
            subtitle="Illustrative starting values. Set limits for your equipment before operational use."
          />
          <div className="form-grid">
            {[
              { key: "temperature_warning", label: "Temperature warning (°C)" },
              {
                key: "temperature_critical",
                label: "Temperature critical (°C)",
              },
              { key: "flow_minimum", label: "Minimum flow (L/min)" },
              { key: "voltage_minimum", label: "Minimum voltage (V)" },
              { key: "voltage_maximum", label: "Maximum voltage (V)" },
            ].map(({ key, label }) => (
              <label key={key}>
                {label}
                <input
                  name={key}
                  type="number"
                  step="any"
                  min={key.includes("temperature") ? -273.15 : 0}
                  required
                  defaultValue={thresholds[key as keyof Thresholds]}
                />
              </label>
            ))}
          </div>
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          {saved && (
            <div className="success-box" role="status">
              <Check size={16} />
              {demo
                ? "Demo thresholds updated for this session."
                : "Thresholds saved to MongoDB."}
            </div>
          )}
          <div className="form-actions">
            <button className="button" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <Settings2 size={15} />
              )}{" "}
              Save thresholds
            </button>
          </div>
        </form>
        <div>
          <section className="panel connection-settings">
            <PanelHeading title="Communication & storage" />
            <dl className="record-list">
              <dt>Environment</dt>
              <dd>{demo ? "Simulated preview" : "Authenticated API"}</dd>
              <dt>API endpoint</dt>
              <dd className="mono">{API_BASE}</dd>
              <dt>Storage</dt>
              <dd>{demo ? "In-memory demo session" : "MongoDB Atlas"}</dd>
              <dt>Refresh interval</dt>
              <dd>{demo ? "Static demo dataset" : "60 seconds"}</dd>
              <dt>Reporting hardware</dt>
              <dd>
                {pumps.filter((p) => p.source === "hardware").length} registered
                (not a connection test)
              </dd>
              <dt>MQTT / ESP32-S3</dt>
              <dd>Integration pending</dd>
              <dt>Trained ML model</dt>
              <dd>See AI diagnostics for model and cloud status</dd>
            </dl>
          </section>
          <section className="panel connection-settings">
            <PanelHeading title="Sensor support" />
            <p className="small-note">
              Available API fields: voltage, flow, density, motor temperature,
              ambient temperature, and humidity. Vibration, current, and
              pressure are not connected.
            </p>
            <a
              className="text-link"
              href={`${API_BASE}/docs`}
              target="_blank"
              rel="noreferrer"
            >
              Open API documentation <ArrowUpRight size={14} />
            </a>
          </section>
        </div>
      </div>
    </>
  );
}
