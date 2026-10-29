import type { Pump, Reading } from "./types";
export const API_BASE = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const token = sessionStorage.getItem("flowraksh-token");
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(
      "Cannot reach the server. Start the backend and check the API URL.",
      0,
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== "/auth/login") {
      sessionStorage.removeItem("flowraksh-token");
      window.dispatchEvent(new Event("flowraksh-session-expired"));
    }
    const message =
      typeof data.detail === "string"
        ? data.detail
        : Array.isArray(data.detail)
          ? data.detail
              .map(
                (item: { msg: string; loc: string[] }) =>
                  `${item.loc.slice(1).join(".")}: ${item.msg}`,
              )
              .join("; ")
          : "Request failed. Please try again.";
    throw new ApiError(message, response.status);
  }
  return data as T;
}
export async function loadPumps(): Promise<Pump[]> {
  const motors: Pump[] = [];
  for (let skip = 0; ; skip += 500) {
    const result = await request<{ items: Pump[]; total: number }>(
      `/motors?skip=${skip}&limit=500`,
    );
    motors.push(...result.items);
    if (motors.length >= result.total || !result.items.length) break;
  }
  return Promise.all(
    motors.map(async (motor) => {
      const details = await request<Pump>(
        `/motors/${encodeURIComponent(motor.id)}?limit=500`,
      );
      const readings: Reading[] = [...details.readings];
      for (let skip = 500; skip < details.total_readings; skip += 500) {
        const page = await request<Pump>(
          `/motors/${encodeURIComponent(motor.id)}?skip=${skip}&limit=500`,
        );
        readings.push(...page.readings);
        if (!page.readings.length) break;
      }
      return { ...details, source: details.source || "manual", readings };
    }),
  );
}
