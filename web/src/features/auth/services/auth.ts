import api from "@/lib/api";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UserSummary {
  id: number | string;
  email: string;
  role: string;
  scheme: string;
}

export interface TenantSummary {
  id: string;
  name: string;
}

export interface LoginResponse {
  token: string;
  user?: UserSummary;
  tenant?: TenantSummary;
}

export const authApi = {
  login: (data: LoginPayload) =>
    api.post<LoginResponse>("/auth/login", data),
};
