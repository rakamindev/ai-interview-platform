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

/** Sign-in failures belong to the form, not to the session handler. */
const isLoginRequest = (url?: string) => !!url && url.includes("/auth/login");

// Unwrap backend envelope: { data: { ... } } → { ... }
api.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === "object" && "data" in response.data) {
      response.data = response.data.data;
    }
    return response;
  },
  (error) => {
    const status = error.response?.status;

    // Only a 401 means the session is no longer good. A 403 means we know who
    // you are and this particular thing is not yours — logging you out for it
    // throws away a working session over one refused request.
    //
    // And never for the login call itself: it answers 401 for a wrong password
    // and 403 for a role without access, and both of those are the form's to
    // display. Redirecting here reloaded the page and wiped the React state
    // before the message could render, so every failed sign-in showed a blink
    // and an empty form with no explanation at all.
    if (status === 401 && !isLoginRequest(error.config?.url)) {
      clearToken();
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;
