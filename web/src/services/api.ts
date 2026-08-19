import axios from "axios";
import { getDevToken, clearAuth } from "@/stores/authAtom";

function requiredEnv(name: string, devFallback: string): string {
  const value = import.meta.env[name] as string | undefined;
  if (value) return value;
  if (import.meta.env.PROD) {
    throw new Error(`[config] ${name} must be set in production`);
  }
  return devFallback;
}

const BASE_URL = requiredEnv("VITE_API_BASE_URL", "http://localhost:3001/api/v1");
const WS_BASE_URL = requiredEnv("VITE_WS_BASE_URL", "ws://localhost:3001");

export const WS_URL = WS_BASE_URL;

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const devToken = getDevToken();
  if (devToken) config.headers.Authorization = `Bearer ${devToken}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== "/login") {
      clearAuth();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
