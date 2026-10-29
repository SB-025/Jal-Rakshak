import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity } from "lucide-react";
import type { Reading } from "./types";
import { formatDate } from "./components";
export default function TrendChart({
  readings,
  metric = "temperature",
  height = 220,
  mini = false,
}: {
  readings: Reading[];
  metric?: "temperature" | "waterflow" | "voltage";
  height?: number;
  mini?: boolean;
}) {
  const colors = {
    temperature: "#292d25",
    waterflow: "#d66a1c",
    voltage: "#657858",
  };
  const units = { temperature: "°C", waterflow: "L/min", voltage: "V" };
  const rows = [...readings]
    .sort(
      (a, b) =>
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    )
    .map((r) => ({ ...r, time: new Date(r.recorded_at).getTime() }));
  if (!rows.length)
    return (
      <div className="empty-chart" style={{ height }}>
        <Activity />
        <p>No sensor history yet</p>
      </div>
    );
  return (
    <div
      className="chart"
      style={{ height }}
      role="img"
      aria-label={`${metric} chart showing ${rows.length} readings; latest ${rows.at(-1)?.[metric]} ${units[metric]}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={rows}
          margin={{ top: 12, right: 12, left: mini ? 0 : -18, bottom: 0 }}
        >
          <defs>
            <linearGradient
              id={`gradient-${metric}-${mini}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={colors[metric]} stopOpacity={0.2} />
              <stop offset="100%" stopColor={colors[metric]} stopOpacity={0} />
            </linearGradient>
          </defs>
          {!mini && (
            <CartesianGrid
              stroke="#e2e9e3"
              vertical={false}
              strokeDasharray="3 5"
            />
          )}
          <XAxis
            dataKey="time"
            hide={mini}
            tickFormatter={(v) =>
              new Date(Number(v)).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })
            }
            minTickGap={45}
            stroke="#748278"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            hide={mini}
            domain={["auto", "auto"]}
            stroke="#748278"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #d9e3dc",
              borderRadius: 8,
              color: "#253b2c",
              fontSize: 12,
            }}
            labelFormatter={(v) =>
              formatDate(new Date(Number(v)).toISOString())
            }
            formatter={(value) => [`${value} ${units[metric]}`, metric]}
          />
          <Area
            type="monotone"
            dataKey={metric}
            stroke={colors[metric]}
            strokeWidth={2}
            fill={`url(#gradient-${metric}-${mini})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
