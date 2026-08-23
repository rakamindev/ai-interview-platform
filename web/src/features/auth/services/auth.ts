import api from "@/shared/services/api";
import type { UserRole } from "@/features/auth/types";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user?: { id: number; email: string; role: UserRole };
}

export const authApi = {
  login: (data: LoginPayload) => api.post<AuthResponse>("/auth/login", data),
};
