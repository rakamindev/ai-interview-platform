import api from "./api";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UserInfo {
  id: number;
  email: string;
  role: "admin" | "user";
}

export interface LoginResponse {
  token: string;
  user: UserInfo;
}

export const authApi = {
  login: (data: LoginPayload) =>
    api.post<LoginResponse>("/auth/login", data),

  signup: (data: { email: string; password: string; role: "admin" | "user" }) =>
    api.post<LoginResponse>("/signup", data),
};
