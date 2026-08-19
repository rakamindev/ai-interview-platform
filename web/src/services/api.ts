import axios from "axios";
import type { ZodType } from "zod";
import { setAuth, clearAuth } from "@/stores/authAtom";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:3000";

export const WS_URL = WS_BASE_URL;

/**
 * Validate API response data against a zod schema.
 * Lenient: unknown keys allowed, per-field failure degrades to fallback.
 */
export function parseResponse<T>(data: unknown, schema: ZodType<T>, fallback: T): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  // oxlint-disable-next-line eslint/no-console
  console.warn("[api] parseResponse failed:", result.error.format());
  return fallback;
}

// oxlint-disable-next-line import/no-named-as-default-member
export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" }
});

api.interceptors.request.use((config) => {
  config.headers["X-Requested-With"] = "XMLHttpRequest";
  return config;
});

// Unwrap backend envelope: { data: { ... } } → { ... }
// On 401/403, clear stored credentials and redirect to login.
api.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === "object" && "data" in response.data) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      try {
        const res = await api.post("/auth/refresh");
        setAuth(res.data.access_token, res.data.user);
        error.config.headers.Authorization = `Bearer ${res.data.access_token}`;
        return api(error.config);
      } catch {
        clearAuth();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// --- Proactive token rotation ---

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
const REFRESH_INTERVAL = 12 * 60 * 1000; // 12 minutes (80% of 15min TTL)

export function startRefreshTimer() {
  stopRefreshTimer();
  refreshTimer = setTimeout(async () => {
    try {
      const res = await api.post("/auth/refresh");
      setAuth(res.data.access_token, res.data.user);
      startRefreshTimer(); // restart
    } catch {
      clearAuth();
      window.location.href = "/login";
    }
  }, REFRESH_INTERVAL);
}

export function stopRefreshTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

export default api;
