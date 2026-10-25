import axios from "axios";
import { getStoredToken, clearToken } from "@/stores/authAtom";
import { clearTenant } from "@/stores/tenantAtom";
import { queryClient } from "@/lib/queryClient";

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
    const url = error.config?.url || "";
    const isLoginEndpoint = url.includes("/auth/login");
    const isAlreadyOnLoginPage =
      typeof window !== "undefined" && window.location.pathname === "/login";

    // Clear credentials and redirect ONLY for expired sessions on protected endpoints,
    // NEVER on login requests or when already on the login page.
    if ((status === 401 || status === 403) && !isLoginEndpoint) {
      clearToken();
      clearTenant();
      queryClient.clear();
      if (!isAlreadyOnLoginPage) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
