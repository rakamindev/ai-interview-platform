import axios from "axios";
import { getStoredToken, clearToken } from "@/stores/authAtom";
import { extractApiError } from "@/lib/apiErrors";
import { toast } from "@/stores/toastStore";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:3000";

export const WS_URL = WS_BASE_URL;

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = "Bearer " + token;
  return config;
});

// Unwrap backend envelope: { data: { ... } } → { ... }.
//
// F-26: every rejection is normalized into a unified ApiError (error.apiError)
// via lib/apiErrors, which understands the canonical envelope
// { error: { code, message } }, the legacy { errors: [...] } envelope and the
// old singular { error: "string" } 429 shape.
//
// - 401/403 (non-login): clear stored credentials, drop a session-expired
//   notice (surfaced as a banner on the login page), redirect to login.
//   The login endpoint itself is excluded: a failed login must surface its
//   backend error message in the login UI instead of reloading the page.
// - 429: global rate-limit toast so the user always knows why requests stopped.
api.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === "object" && "data" in response.data) {
      response.data = response.data.data;
    }
    return response;
  },
  (error) => {
    const normalized = extractApiError(error);
    error.apiError = normalized;

    const isLoginRequest = error.config?.url?.includes("/auth/login");
    const status = error.response?.status;

    if ((status === 401 || status === 403) && !isLoginRequest) {
      sessionStorage.setItem("auth_expired", "1");
      clearToken();
      window.location.href = "/login";
      return Promise.reject(error);
    }

    if (status === 429) {
      toast.error(
        normalized.message || "Too many requests",
        "Please wait a moment before trying again."
      );
    }

    return Promise.reject(error);
  }
);

export default api;