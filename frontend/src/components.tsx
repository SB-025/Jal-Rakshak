/* oxlint-disable react/only-export-components -- Shared display helpers live with their UI components. */
import { lazy, Suspense, useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Droplets,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Pump, Reading } from "./types";
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" to="/" aria-label="FlowRaksh home">
      <span className="brand-mark">
        <Droplets size={22} />
        <span />
      </span>
      {!compact && (
        <span>
          flow<span className="brand-light">raksh</span>
        </span>
      )}
    </Link>
  );
}
export function Badge({
  children,
  tone = "",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
export function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
export function Status({ pump }: { pump: Pump }) {
  const now = useClock();
  if (pump.source === "demo") return <Badge tone="demo">Simulated</Badge>;
  if (!pump.latest_reading) return <Badge tone="muted">No readings</Badge>;
  const fresh =
    now - new Date(pump.latest_reading.recorded_at).getTime() < 300000;
  return (
    <Badge tone={fresh ? "success" : "muted"}>
      {fresh ? "Recent data" : "Stale data"}
    </Badge>
  );
}
export function formatDate(value?: string | null) {
  return value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not received";
}
export function ago(value?: string) {
  if (!value) return "No data";
  const mins = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000),
  );
  return mins < 1
    ? "Just now"
    : mins < 60
      ? `${mins}m ago`
      : mins < 1440
        ? `${Math.floor(mins / 60)}h ago`
        : `${Math.floor(mins / 1440)}d ago`;
}
const LazyChart = lazy(() => import("./TrendChart"));
export function TrendChart(props: {
  readings: Reading[];
  metric?: "temperature" | "waterflow" | "voltage";
  height?: number;
  mini?: boolean;
}) {
  return (
    <Suspense
      fallback={
        <div className="empty-chart" style={{ height: props.height || 220 }}>
          Loading chart…
        </div>
      }
    >
      <LazyChart {...props} />
    </Suspense>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow || "OPERATIONS WORKSPACE"}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Radio size={30} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function PanelHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel-heading">
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function Preview() {
  const [now] = useState(() => Date.now());
  return (
    <div className="product-preview">
      <div className="preview-top">
        <span>
          <ShieldCheck size={16} /> FLOWRAKSH / MONITOR
        </span>
        <Badge tone="demo">DEMO DATA</Badge>
      </div>
      <div className="preview-body">
        <div className="preview-pump">
          <div>
            <span className="tiny-label">PUMP STATION 01</span>
            <h3>Worli intake pump</h3>
            <p>Mumbai, Maharashtra</p>
          </div>
          <span className="pump-orbit">
            <Droplets size={26} />
          </span>
        </div>
        <div className="preview-health">
          <span>
            <span className="live-dot" /> Normal operating range
          </span>
          <span>SIMULATED</span>
        </div>
        <div className="preview-metrics">
          <div>
            <span>Motor temperature</span>
            <strong>
              46.2 <small>°C</small>
            </strong>
            <em>Within demo threshold</em>
          </div>
          <div>
            <span>Water flow</span>
            <strong>
              44.8 <small>L/min</small>
            </strong>
            <em>Stable demo flow</em>
          </div>
        </div>
        <div className="chart-label">
          <span>
            <i />
            Temperature trend
          </span>
          <span>Last 6 hours</span>
        </div>
        <TrendChart
          readings={Array.from({ length: 20 }, (_, i) => ({
            id: String(i),
            motor_id: "preview",
            temperature: 46 + Math.sin(i * 0.5) * 1.6,
            voltage: 230,
            waterflow: 44.8,
            density: 998,
            humidity: 64,
            environment_temperature: 30,
            source: "demo",
            recorded_at: new Date(now - (19 - i) * 900000).toISOString(),
          }))}
          height={140}
          mini
        />
        <div className="preview-log">
          <Activity size={15} />
          <span>Rule evaluation complete</span>
          <span className="text-teal">No threshold events</span>
        </div>
        <div className="preview-footer">
          <span>ESP32-S3 integration planned</span>
          <span>
            HTTP data pipeline <ArrowUpRight size={12} />
          </span>
        </div>
      </div>
    </div>
  );
}
