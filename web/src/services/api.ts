import axios from "axios";
import { getStoredToken, clearToken } from "@/stores/authAtom";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api/v1";
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:3001";

export const WS_URL = WS_BASE_URL;

export const api = axios.create({
  baseURL: BASE_URL,
  // No default Content-Type on purpose. axios infers it per request: it sets
  // application/json for plain objects, and leaves FormData untouched so the
  // browser can add its own multipart boundary. Declaring application/json here
  // made axios serialize CV uploads to JSON ({"cv":{}}), silently dropping the file.
  headers: {
    Accept: "application/json",
  },
});

api.interceptors.request.use((config) => {
  const url = config.url ?? "";
  const isAuthEndpoint = url.includes("/auth/login") || url.includes("/signup");
  const token = getStoredToken();
  if (token && !isAuthEndpoint) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Candidate-facing endpoints authenticate with the invite token in the URL, never
// with a JWT. A 401/403 from one of them means the upload/lookup itself failed —
// not that the user's session expired — so it must not clear credentials or
// redirect to the assessor login (that would throw the candidate out of the
// interview they are in the middle of).
const INVITE_TOKEN_ENDPOINT = /\/sessions\/[^/]+\/(candidate|cv|audio_complete)(?:[/?#]|$)/;

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
    const url: string = error.config?.url ?? "";
    const isAuthEndpoint = url.includes("/auth/login") || url.includes("/signup");
    const isInviteTokenEndpoint = INVITE_TOKEN_ENDPOINT.test(url);
    if (
      !isAuthEndpoint &&
      !isInviteTokenEndpoint &&
      (error.response?.status === 401 || error.response?.status === 403)
    ) {
      clearToken();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
