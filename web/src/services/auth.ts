import api from "./api";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface GoogleLoginPayload {
  credential?: string;
  id_token?: string;
  email?: string;
  name?: string;
  avatar_url?: string;
}

export interface LoginResponse {
  token: string;
  user?: {
    id: number;
    email: string;
    name?: string;
    avatar_url?: string;
    role: string;
  };
  provider?: string;
}

export const authApi = {
  login: (data: LoginPayload) =>
    api.post<LoginResponse>("/auth/login", data),

  loginGoogle: (data: GoogleLoginPayload) =>
    api.post<LoginResponse>("/auth/google", data),

  signup: (data: { email: string; password: string; role: "admin" | "user" }) =>
    api.post<LoginResponse>("/signup", data),

  me: () =>
    api.get<{ user: { id: number; email: string; name?: string; avatar_url?: string; role: string } }>("/auth/me"),
};
