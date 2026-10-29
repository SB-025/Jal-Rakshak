/* oxlint-disable react/only-export-components -- Provider and consumer form one data boundary. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { loadPumps, request } from "./api";
import { demoMaintenance, demoPumps } from "./demo";
import { mergeMotorStates, previewStates } from "./motor-state";
import {
  defaultThresholds,
  type Alert,
  type AlertAction,
  type Pump,
  type MotorState,
  type Thresholds,
  type WorkOrder,
} from "./types";

export function makeAlerts(
  pumps: Pump[],
  thresholds: Thresholds,
  actions: AlertAction[],
): Alert[] {
  return pumps.flatMap((pump) => {
    const r = pump.latest_reading;
    if (!r) return [];
    const found: Alert[] = [];
    const add = (
      key: string,
      severity: "warning" | "critical",
      title: string,
      evidence: string,
      recommendation: string,
    ) => {
      const id = `${r.id}-${key}`;
      found.push({
        id,
        pump,
        severity,
        title,
        evidence,
        recommendation,
        timestamp: r.recorded_at,
        status: actions.find((a) => a.alert_id === id)?.status || "open",
      });
    };
    if (r.temperature >= thresholds.temperature_warning)
      add(
        "temperature",
        r.temperature >= thresholds.temperature_critical
          ? "critical"
          : "warning",
        "Elevated motor temperature",
        `${r.temperature} °C · warning threshold ${thresholds.temperature_warning} °C`,
        "Inspect cooling airflow, bearings, and operating load. A cause has not been confirmed.",
      );
    if (r.waterflow < thresholds.flow_minimum)
      add(
        "flow",
        "warning",
        "Water flow below threshold",
        `${r.waterflow} L/min · minimum ${thresholds.flow_minimum} L/min`,
        "Inspect intake obstruction, valves, and water availability before returning to service.",
      );
    if (
      r.voltage < thresholds.voltage_minimum ||
      r.voltage > thresholds.voltage_maximum
    )
      add(
        "voltage",
        "critical",
        "Voltage outside configured range",
        `${r.voltage} V · expected ${thresholds.voltage_minimum}–${thresholds.voltage_maximum} V`,
        "Have a qualified operator inspect the power supply and electrical connections.",
      );
    return found;
  });
}
interface Context {
  demo: boolean;
  motorStates: Record<string, MotorState>;
  motorStatesLoading: boolean;
  motorStateError: string;
  motorStateBusy: Record<string, boolean>;
  refreshMotorStates: () => Promise<void>;
  setMotorPower: (motorId: string, state: "on" | "off") => Promise<void>;
  pumps: Pump[];
  maintenance: WorkOrder[];
  actions: AlertAction[];
  thresholds: Thresholds;
  alerts: Alert[];
  loading: boolean;
  error: string;
  refreshing: boolean;
  lastSync: Date | null;
  refresh: () => Promise<void>;
  createMotor: (body: unknown) => Promise<Pump>;
  addReading: (body: unknown) => Promise<void>;
  createWork: (body: Omit<WorkOrder, "id" | "created_at">) => Promise<void>;
  updateWork: (id: string, status: WorkOrder["status"]) => Promise<void>;
  setAlert: (alert: Alert, status: string) => Promise<void>;
  saveSettings: (settings: Thresholds) => Promise<void>;
}
const DataContext = createContext<Context | null>(null);
export function DataProvider({
  demo,
  children,
}: {
  demo: boolean;
  children: ReactNode;
}) {
  const [pumps, setPumps] = useState<Pump[]>(demo ? demoPumps : []);
  const [maintenance, setMaintenance] = useState<WorkOrder[]>(
    demo ? demoMaintenance : [],
  );
  const [actions, setActions] = useState<AlertAction[]>([]);
  const [thresholds, setThresholds] = useState<Thresholds>(defaultThresholds);
  const [loading, setLoading] = useState(!demo);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [motorStates, setMotorStates] = useState<Record<string, MotorState>>(
    () => (demo ? previewStates(demoPumps) : {}),
  );
  const [motorStatesLoading, setMotorStatesLoading] = useState(!demo);
  const [motorStateError, setMotorStateError] = useState("");
  const [motorStateBusy, setMotorStateBusy] = useState<Record<string, boolean>>(
    {},
  );
  const motorRequests = useRef(new Set<string>());
  const refreshMotorStates = useCallback(async () => {
    if (demo) return;
    try {
      const states: MotorState[] = [];
      for (let skip = 0; ; skip += 500) {
        const page = await request<{ items: MotorState[]; total: number }>(
          `/motor-states?skip=${skip}&limit=500`,
        );
        states.push(...page.items);
        if (states.length >= page.total || !page.items.length) break;
      }
      setMotorStates((previous) => mergeMotorStates(previous, states));
      setMotorStateError("");
    } catch (error) {
      setMotorStateError(
        error instanceof Error ? error.message : "Could not load motor states",
      );
    } finally {
      setMotorStatesLoading(false);
    }
  }, [demo]);
  const setMotorPower = useCallback(
    async (motorId: string, state: "on" | "off") => {
      if (motorRequests.current.has(motorId))
        throw new Error("A state request is already being saved.");
      motorRequests.current.add(motorId);
      setMotorStateBusy((previous) => ({ ...previous, [motorId]: true }));
      try {
        if (demo) {
          const pump = demoPumps.find((item) => item.id === motorId);
          if (!pump) throw new Error("Demo motor not found");
          const now = new Date().toISOString();
          setMotorStates((previous) => {
            const old = previous[motorId] || previewStates([pump])[motorId];
            return {
              ...previous,
              [motorId]: {
                ...old,
                state,
                is_on: state === "on",
                desired_state: state,
                last_reported_state: state,
                reported_at: now,
                requested_at: now,
                command_id: crypto.randomUUID(),
                command_status: "simulated",
                revision: old.revision + 1,
              },
            };
          });
        } else {
          const result = await request<MotorState>(
            `/motors/${encodeURIComponent(motorId)}/state`,
            "POST",
            { state, source: "operator", reason: "Dashboard power switch" },
          );
          setMotorStates((previous) => mergeMotorStates(previous, [result]));
          setMotorStateError("");
        }
      } catch (error) {
        if (!demo) void refreshMotorStates();
        throw error;
      } finally {
        motorRequests.current.delete(motorId);
        setMotorStateBusy((previous) => ({ ...previous, [motorId]: false }));
      }
    },
    [demo, refreshMotorStates],
  );
  useEffect(() => {
    if (demo) return;
    const timer = window.setInterval(() => void refreshMotorStates(), 10000);
    return () => window.clearInterval(timer);
  }, [demo, refreshMotorStates]);
  const refresh = useCallback(async () => {
    if (demo) {
      setLoading(false);
      return;
    }
    setRefreshing(true);
    try {
      const [nextPumps, work, alertActions, settings] = await Promise.all([
        loadPumps(),
        request<WorkOrder[]>("/maintenance"),
        request<AlertAction[]>("/alert-actions"),
        request<Thresholds>("/settings"),
        refreshMotorStates(),
      ]);
      setPumps(nextPumps);
      setMaintenance(work);
      setActions(alertActions);
      setThresholds(settings);
      setError("");
      setLastSync(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [demo, refreshMotorStates]);
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 60000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refresh]);
  const alerts = useMemo(
    () => makeAlerts(pumps, thresholds, actions),
    [pumps, thresholds, actions],
  );
  async function createMotor(body: unknown) {
    if (demo)
      throw new Error(
        "Sign in to register a motor in MongoDB. Demo mode is a preview.",
      );
    const result = await request<Pump>("/motors", "POST", body);
    await refresh();
    return result;
  }
  async function addReading(body: unknown) {
    if (demo) throw new Error("Sign in to save a sensor reading.");
    await request("/readings", "POST", body);
    await refresh();
  }
  async function createWork(body: Omit<WorkOrder, "id" | "created_at">) {
    if (demo)
      setMaintenance((old) => [
        {
          ...body,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
        },
        ...old,
      ]);
    else {
      await request("/maintenance", "POST", body);
      await refresh();
    }
  }
  async function updateWork(id: string, status: WorkOrder["status"]) {
    if (demo)
      setMaintenance((old) =>
        old.map((work) => (work.id === id ? { ...work, status } : work)),
      );
    else {
      await request(`/maintenance/${id}`, "PATCH", { status });
      await refresh();
    }
  }
  async function setAlert(alert: Alert, status: string) {
    const body = { alert_id: alert.id, motor_id: alert.pump.id, status };
    if (demo)
      setActions((old) => [
        ...old.filter((action) => action.alert_id !== alert.id),
        body,
      ]);
    else {
      await request("/alert-actions", "POST", body);
      await refresh();
    }
  }
  async function saveSettings(settings: Thresholds) {
    if (!demo) await request("/settings", "POST", settings);
    setThresholds(settings);
  }
  return (
    <DataContext.Provider
      value={{
        demo,
        motorStates,
        motorStatesLoading,
        motorStateError,
        motorStateBusy,
        refreshMotorStates,
        setMotorPower,
        pumps,
        maintenance,
        actions,
        thresholds,
        alerts,
        loading,
        refreshing,
        error,
        lastSync,
        refresh,
        createMotor,
        addReading,
        createWork,
        updateWork,
        setAlert,
        saveSettings,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
export function useData() {
  const value = useContext(DataContext);
  if (!value) throw new Error("Missing data provider");
  return value;
}
