import type { Pump, WorkOrder } from "./types";
const now = Date.now();
export const demoPumps: Pump[] = [
  [
    "demo-01",
    "Worli · Intake pump",
    "DEMO-WORLI-01",
    19.0176,
    72.8162,
    "7.5 HP",
  ],
  ["demo-02", "Dadar · Booster pump", "DEMO-DADAR-02", 19.018, 72.842, "5 HP"],
  [
    "demo-03",
    "Bandra · Transfer pump",
    "DEMO-BANDRA-03",
    19.06,
    72.835,
    "10 HP",
  ],
].map((item, i) => {
  const [id, motor_name, motor_oid, latitude, longitude, size] = item;
  const readings = Array.from({ length: 24 }, (_, n) => ({
    id: `${id}-${n}`,
    motor_id: String(id),
    voltage: +(230 + Math.sin(n * 0.7) * 4).toFixed(1),
    waterflow: +(i === 1 ? 35 - n * 0.75 : 44 + Math.sin(n * 0.8) * 3).toFixed(
      1,
    ),
    density: 998.2,
    temperature: +(
      i === 1 ? 53 + n * 0.9 : 45 + Math.sin(n * 0.4) * 3 + i * 4
    ).toFixed(1),
    environment_temperature: 29.6,
    humidity: 64,
    recorded_at: new Date(now - (23 - n) * 15 * 60000).toISOString(),
    source: "demo" as const,
  })).reverse();
  return {
    id: String(id),
    motor_name: String(motor_name),
    motor_oid: String(motor_oid),
    coordinates: { latitude: Number(latitude), longitude: Number(longitude) },
    size: String(size),
    source: "demo" as const,
    created_at: new Date(now).toISOString(),
    readings,
    latest_reading: readings[0],
    total_readings: readings.length,
  };
});
export const demoMaintenance: WorkOrder[] = [
  {
    id: "demo-work-1",
    motor_id: "demo-02",
    title: "Inspect inlet and motor cooling",
    notes:
      "Demo work order: check intake obstruction and cooling airflow after elevated temperature and reduced flow.",
    scheduled_date: new Date(now + 86400000).toISOString().slice(0, 10),
    status: "scheduled",
    created_at: new Date(now).toISOString(),
  },
];
