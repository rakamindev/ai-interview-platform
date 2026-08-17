import axios, { type AxiosRequestConfig } from "axios";
import { getStoredToken, clearToken } from "@/stores/authAtom";

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:3000";

export const WS_URL = WS_BASE_URL;

// Candidate-facing requests (invite token only) opt out of the auth-redirect
// interceptor so 403s render inline instead of bouncing to the assessor login.
export type CandidateRequestConfig = AxiosRequestConfig & {
  skipAuthRedirect?: boolean;
};

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
// On 401/403, clear stored credentials and redirect to login — EXCEPT for
// candidate-facing endpoints (invite-token only), which opt out via
// `skipAuthRedirect` so a 403 (e.g. consent required) renders inline instead
// of bouncing the candidate to the assessor login page.
api.interceptors.response.use(
  (response) => {
    if (
      response.data &&
      typeof response.data === "object" &&
      "data" in response.data
    ) {
      response.data = response.data.data;
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      if (
        !(error.config as CandidateRequestConfig | undefined)?.skipAuthRedirect
      ) {
        clearToken();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
