import axios from "axios";
import { getStoredToken, clearToken } from "@/stores/authAtom";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL;

// Required build-time config (see web/.env.example). Fail loudly instead of guessing a host.
if (!BASE_URL || !WS_BASE_URL) {
  throw new Error("VITE_API_BASE_URL and VITE_WS_BASE_URL must be set (see web/.env.example).");
}

export const WS_URL: string = WS_BASE_URL;

// A hung request must end in an error state instead of an endless spinner.
const REQUEST_TIMEOUT_MS = 30_000;

const LOGIN_PATH = "/auth/login";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Unwrap backend envelope: { data: { ... } } → { ... }
// On 401 (missing/invalid token), clear stored credentials and redirect to login.
// A 403 means the signed-in user lacks access to this resource; the page reports it
// instead of discarding the session.
api.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === "object" && "data" in response.data) {
      response.data = response.data.data;
    }
    return response;
  },
  (error) => {
    // A rejected sign-in is reported by the login form itself; reloading /login would erase it.
    const isLoginRequest = error.config?.url === LOGIN_PATH;
    if (!isLoginRequest && error.response?.status === 401) {
      clearToken();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;
