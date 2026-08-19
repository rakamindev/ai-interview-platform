import api from "./api";
import type { DashboardStats } from "@/types";

export const dashboardApi = {
  getStats: () => api.get<DashboardStats>("/dashboard/stats"),
};
