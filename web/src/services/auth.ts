import api from "./api";

export type UserRole = "admin" | "assessor" | "hiring_manager" | "user";

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
}

export interface OrganizationInfo {
  id: number;
  name: string;
  scheme: string;
  host?: string;
  config?: Record<string, any>;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  email: string;
  password: string;
  role?: UserRole;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
  organization?: OrganizationInfo;
}

export const authApi = {
  login: (data: LoginPayload) =>
    api.post<AuthResponse>("/auth/login", data),

  signup: (data: SignupPayload) =>
    api.post<AuthResponse>("/auth/signup", data),

  me: () =>
    api.get<{ user: AuthUser; organization?: OrganizationInfo }>("/auth/me"),
};
