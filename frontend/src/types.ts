export type Source = "demo" | "manual" | "hardware";
export interface Reading {
  id: string;
  motor_id: string;
  voltage: number;
  waterflow: number;
  density: number;
  temperature: number;
  environment_temperature: number;
  humidity: number;
  vibration_rms?: number | null;
  current?: number | null;
  pressure?: number | null;
  recorded_at: string;
  source: Source;
}
export interface Pump {
  id: string;
  motor_name: string;
  motor_oid: string;
  coordinates: { latitude: number; longitude: number };
  size: string;
  source: Source;
  created_at: string;
  readings: Reading[];
  latest_reading: Reading | null;
  total_readings: number;
}
export interface WorkOrder {
  id: string;
  motor_id: string;
  title: string;
  notes: string;
  scheduled_date: string;
  status: "scheduled" | "in_progress" | "completed";
  created_at: string;
}
export interface Thresholds {
  temperature_warning: number;
  temperature_critical: number;
  flow_minimum: number;
  voltage_minimum: number;
  voltage_maximum: number;
}
export interface Alert {
  id: string;
  pump: Pump;
  severity: "warning" | "critical";
  title: string;
  evidence: string;
  recommendation: string;
  timestamp: string;
  status: string;
}
export interface AlertAction {
  alert_id: string;
  motor_id: string;
  status: string;
}
export interface MotorState {
  motor_id: string;
  motor_oid: string;
  motor_name: string;
  is_simulated: boolean;
  state: "on" | "off" | "unknown";
  is_on: boolean | null;
  desired_state: "on" | "off" | null;
  last_reported_state: "on" | "off" | "unknown";
  confirmation_source: "demo" | "device" | null;
  reported_at: string | null;
  requested_at: string | null;
  stale: boolean;
  freshness_timeout_seconds: number;
  command_id: string | null;
  command_status:
    "not_requested" | "simulated" | "acknowledged" | "pending_device";
  revision: number;
}
export const defaultThresholds: Thresholds = {
  temperature_warning: 65,
  temperature_critical: 80,
  flow_minimum: 20,
  voltage_minimum: 200,
  voltage_maximum: 250,
};
