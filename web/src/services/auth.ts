import api from "./api";
import type { UserProfile } from "@/stores/authAtom";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user?: UserProfile;
}

export const authApi = {
  login: (data: LoginPayload) =>
    api.post<LoginResponse>("/auth/login", data),

  signup: (data: { email: string; password: string; role: "admin" | "user" }) =>
    api.post<LoginResponse>("/signup", data),

  getMe: () =>
    api.get<{ user: UserProfile; tenant: { id: string; name: string } }>("/auth/me"),
};
