import axios from "axios";
import type { ZodType } from "zod";
import { getStoredToken, clearToken } from "@/stores/authAtom";

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
  console.warn("[api] parseResponse failed:", result.error.format());
  return fallback;
}

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" }
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
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
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      clearToken();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
