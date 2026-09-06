import api from "./api";

export interface HealthResponse {
  status: string;
}

export const healthApi = {
  check: () => api.get<HealthResponse>("/health", { timeout: 5000 }),
};