import axios from "axios";
import { getStoredToken, clearToken } from "@/stores/authAtom";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL;

export const WS_URL = WS_BASE_URL;

// Key for handing a message ("session expired", "invalid token") from this interceptor to the login page (read once, then cleared)

export const AUTH_NOTICE_KEY = "auth_notice";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000, // fail instead of spinning forever on a bad connection
});

api.interceptors.request.use(config => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Unwrap backend envelope: { data: { ... } } -> { ... }
api.interceptors.response.use(
  response => {
    if (
      response.data &&
      typeof response.data === "object" &&
      "data" in response.data
    ) {
      response.data = response.data.data;
    }
    return response;
  },
  error => {
    const isAuthRequest = String(error.config?.url ?? "").startsWith("/auth/");

    // 401 on a protected call = missing/expired/modified token -> back to login.
    // Login/signup 401s are normal form errors: do NOT redirect (would wipe the message).
    // 403 means "forbidden", not "logged out", so it no longer clears the session.
    if (error.response?.status === 401 && !isAuthRequest) {
      const msg =
        error.response?.data?.errors?.[0]?.message ??
        "Your session is invalid. Please sign in again.";
      clearToken();
      // Why sessionStorage (not localStorage): it is scoped to this tab and cleared when
      // the tab closes, so a stale message never shows up in another tab or a later visit.
      sessionStorage.setItem(AUTH_NOTICE_KEY, msg);
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;
// import axios from "axios";
// import { getStoredToken, clearToken } from "@/stores/authAtom";

// const BASE_URL = import.meta.env.VITE_API_BASE_URL;
// // ?? "http://localhost:3000/api/v1";
// const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL;
// // ?? "ws://localhost:3000";

// export const WS_URL = WS_BASE_URL;

// export const api = axios.create({
//   baseURL: BASE_URL,
//   headers: { "Content-Type": "application/json" },
// });

// api.interceptors.request.use(config => {
//   const token = getStoredToken();
//   if (token) config.headers.Authorization = `Bearer ${token}`;
//   return config;
// });

// // Unwrap backend envelope: { data: { ... } } → { ... }
// // On 401/403, clear stored credentials and redirect to login.
// api.interceptors.response.use(
//   response => {
//     if (
//       response.data &&
//       typeof response.data === "object" &&
//       "data" in response.data
//     ) {
//       response.data = response.data.data;
//     }
//     console.log("API response:", response);
//     return response;
//   },
//   error => {
//     if (error.response?.status === 401 || error.response?.status === 403) {
//       clearToken();
//       window.location.href = "/login";
//     }
//     return Promise.reject(error);
//   },
// );

// export default api;
