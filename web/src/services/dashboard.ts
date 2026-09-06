import api from "./api";
import type { AssessmentDashboard, DashboardStats } from "@/types";

export const dashboardApi = {
  stats: () => api.get<DashboardStats>("/dashboard/stats"),

  assessment: (assessmentId: number) =>
    api.get<AssessmentDashboard>(`/assessments/${assessmentId}/dashboard`),
};