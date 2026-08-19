import api from "./api";
import type { UserRole } from "@/types";

export interface LoginPayload {
  email: string;
  password: string;
}

// Self-signup always creates a "user" account — role isn't user-selectable,
// the api ignores/overrides it server-side regardless.
export interface SignupPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user?: { id: number; email: string; role: UserRole };
}

export const authApi = {
  login: (data: LoginPayload) => api.post<AuthResponse>("/auth/login", data),
  signup: (data: SignupPayload) => api.post<AuthResponse>("/signup", data),
};
