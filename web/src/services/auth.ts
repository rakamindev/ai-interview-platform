import api from "./api";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: { id: number; email: string; role: string };
  organization: { id: number; name: string; scheme: string };
}

export const authApi = {
  login: (data: LoginPayload) =>
    api.post<LoginResponse>("/auth/login", data),

  signup: (data: { email: string; password: string; role: "admin" | "user" }) =>
    api.post<LoginResponse>("/signup", data),
};
