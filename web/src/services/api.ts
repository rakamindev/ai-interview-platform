import axios from "axios";
import type { ZodType } from "zod";
import { setAuth, clearAuth, getAccessToken } from "@/stores/authAtom";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:3000";

export const WS_URL = WS_BASE_URL;

/**
 * Extract a structured error code from an API error response.
 * Returns undefined when the backend didn't provide a code (network errors, etc).
 */
export function getErrorCode(error: unknown): string | undefined {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "errors" in error.response.data &&
    Array.isArray(error.response.data.errors) &&
    error.response.data.errors.length > 0 &&
    "code" in error.response.data.errors[0]
  ) {
    return String(error.response.data.errors[0].code);
  }
  return undefined;
}

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
  headers: { "Content-Type": "application/json" },
  // Required for the httpOnly refresh cookie and the csrf_secret cookie to be
  // sent/stored at all — API and web run on different origins in dev and prod.
  withCredentials: true
});

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const REFRESH_URL = "/auth/refresh";
const LOGIN_URL = "/auth/login";

api.interceptors.request.use((config) => {
  config.headers["X-Requested-With"] = "XMLHttpRequest";
  const csrfSecret = readCookie("csrf_secret");
  if (csrfSecret) {
    config.headers["X-CSRF-Token"] = csrfSecret;
  }
  const accessToken = getAccessToken();
  if (accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Single shared refresh call — every caller (401 retries, the proactive timer)
// awaits the same in-flight promise instead of each firing its own request.
let refreshPromise: Promise<{ access_token: string; user: unknown }> | null = null;

export function performRefresh() {
  if (!refreshPromise) {
    refreshPromise = api
      .post(REFRESH_URL)
      .then((res) => {
        setAuth(res.data.access_token, res.data.user);
        return res.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

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
    // The refresh call itself goes through this same instance/interceptor. If its
    // own 401 were retried here too, a dead refresh token would recurse forever —
    // let it fail straight through instead. Each caller of performRefresh() (the
    // retry branch below, the proactive timer, App.tsx's boot check) already
    // decides for itself what a failed refresh means, so no redirect belongs here.
    const isRefreshCall = error.config?.url === REFRESH_URL;
    const isLoginCall = error.config?.url === LOGIN_URL;
    if (error.response?.status === 401 && !error.config._retry && !isRefreshCall && !isLoginCall) {
      error.config._retry = true;
      try {
        const data = await performRefresh();
        error.config.headers.Authorization = `Bearer ${data.access_token}`;
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
      await performRefresh();
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
