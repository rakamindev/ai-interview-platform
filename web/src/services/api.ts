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

import {
  mockAssessments,
  mockSessions,
  mockPortfolio,
  mockFitGapReport,
  mockVacancies,
  mockTranscripts,
} from "./mockData";

function getMockData(url: string = "") {
  const cleanUrl = url.replace(/^\/api\/v1/, "");
  if (cleanUrl.includes("/auth/login")) {
    return { token: "demo-jwt-token-active", user: { id: 1, email: "admin@ai-interview.com", role: "admin" } };
  }
  if (cleanUrl.match(/\/portfolios\/\d+\/fitgap\/\d+/)) {
    return { report: mockFitGapReport };
  }
  if (cleanUrl.match(/\/sessions\/\d+\/portfolio/)) {
    return { portfolio: mockPortfolio };
  }
  if (cleanUrl.match(/\/sessions\/\d+\/transcript/)) {
    return { turns: mockTranscripts };
  }
  if (cleanUrl.match(/\/assessments\/\d+\/sessions/)) {
    return { sessions: mockSessions };
  }
  if (cleanUrl.match(/\/assessments\/\d+/)) {
    return { assessment: mockAssessments[0] };
  }
  if (cleanUrl.includes("/assessments")) {
    return { assessments: mockAssessments };
  }
  if (cleanUrl.match(/\/vacancies\/\d+/)) {
    return { vacancy: mockVacancies[0] };
  }
  if (cleanUrl.includes("/vacancies")) {
    return { vacancies: mockVacancies };
  }
  if (cleanUrl.includes("/portfolio_skills")) {
    return { success: true };
  }
  return null;
}

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
    // If backend is offline or network error, fallback gracefully so the web works
    if (error.code === "ERR_NETWORK" || !error.response) {
      const mock = getMockData(error.config?.url);
      if (mock !== null) {
        return Promise.resolve({ data: mock, status: 200, statusText: "OK", headers: {}, config: error.config });
      }
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      clearToken();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;

