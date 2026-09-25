import api from "./api";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: { id: number; email: string; role: string };
  organization: { id: number; name: string; scheme: string };
}

export const authApi = {
  login: (data: LoginPayload) => api.post<AuthResponse>("/auth/login", data),

  signup: (data: { organization_name: string; email: string; password: string }) =>
    api.post<AuthResponse>("/auth/register", data),

  forgotPassword: (email: string) =>
    api.post<{ message: string; dev_reset_token?: string }>("/auth/forgot_password", { email }),

  resetPassword: (data: { token: string; password: string; password_confirmation: string }) =>
    api.post<{ message: string }>("/auth/reset_password", data),
};
