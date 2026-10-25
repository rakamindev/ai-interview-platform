import api from "./api";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginUser {
  id: number;
  email: string;
  role: string;
}

export interface LoginTenant {
  id: number;
  name: string;
}

export interface LoginResponse {
  token: string;
  user: LoginUser;
  tenant: LoginTenant;
}

export const authApi = {
  login: (data: LoginPayload) =>
    api.post<LoginResponse>("/auth/login", data),
};
