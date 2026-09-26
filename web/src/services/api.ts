import axios from "axios";
import { getStoredToken, clearToken } from "@/stores/authAtom";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api/v1";
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:3001";

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
// On 401/403, clear stored credentials and redirect to login, because the
// session has expired. A failed login is not an expired session: it is left
// to the login page, which shows the error (a redirect would reload the page
// and wipe it).
api.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === "object" && "data" in response.data) {
      response.data = response.data.data;
    }
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const isLogin = String(error.config?.url ?? "").endsWith("/auth/login");
    if ((status === 401 || status === 403) && !isLogin) {
      clearToken();
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
