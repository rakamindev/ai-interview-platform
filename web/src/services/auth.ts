import api from "./api";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    email: string;
    role: "admin" | "assessor";
  };
  organization: {
    id: number;
    name: string;
    scheme: string;
  } | null;
}

export const authApi = {
  login: (data: LoginPayload) =>
    api.post<LoginResponse>("/auth/login", data),

  changePassword: (data: { current_password: string; password: string }) =>
    api.post<{ message: string }>("/auth/change_password", data),
};
