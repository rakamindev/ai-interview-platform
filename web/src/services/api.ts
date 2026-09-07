import axios from "axios";
import { getStoredToken, clearToken } from "@/stores/authAtom";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:3000";

export const WS_URL = WS_BASE_URL;

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
    const status = error.response?.status;
    const isLoginAttempt = (error.config?.url ?? "").includes("/auth/login");

    // The redirect exists to bounce an expired session back to the login
    // screen. Applying it to the login request itself meant a wrong password
    // triggered a full page navigation to /login — React remounted, the
    // component's `error` state was destroyed with it, and the form simply
    // cleared. LoginPage does set "Invalid email or password", and it could
    // never be seen. Someone whose password is wrong, or who has no account
    // because db:seed creates none, gets no explanation at all.
    if ((status === 401 || status === 403) && !isLoginAttempt) {
      clearToken();
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;
