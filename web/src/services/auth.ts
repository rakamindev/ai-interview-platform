import { api } from "./api";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: { id: string; email: string; role: string };
}

export const authApi = {
  login: (data: LoginPayload) => api.post<LoginResponse>("/auth/login", data),

  signup: (data: { email: string; password: string; role: "admin" | "user" }) =>
    api.post<LoginResponse>("/signup", data),

  acceptInvite: (data: { token: string; password: string }) =>
    api.post<LoginResponse>("/auth/accept_invite", data),

  createInvite: (data: { email: string; role: "admin" | "assessor" }) =>
    api.post<{ invite_url: string }>("/auth/invites", { invite: data })
};
