import axios from "axios";
import { getStoredToken, clearToken } from "@/stores/authAtom";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:3000";

export const WS_URL = WS_BASE_URL;

// Pulls the API's human-readable error message out of an Axios failure. Export
// requests use responseType "blob", so the error body is a Blob containing JSON.
export async function extractExportError(error: unknown): Promise<string | null> {
  if (!axios.isAxiosError(error)) return null;
  const data = error.response?.data;
  let parsed: { errors?: Array<{ message?: string }> } | null = null;
  if (data instanceof Blob) {
    try {
      parsed = JSON.parse(await data.text());
    } catch {
      parsed = null;
    }
  } else if (data && typeof data === "object") {
    parsed = data as { errors?: Array<{ message?: string }> };
  }
  return parsed?.errors?.[0]?.message ?? null;
}

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
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
