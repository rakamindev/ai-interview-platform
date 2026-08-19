import api from "./api";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export const authApi = {
  login: (data: LoginPayload) => api.post<LoginResponse>("/auth/login", data),
  
  register: (data: { email: string; password: string }) => 
    api.post<LoginResponse>("/auth/register", data),
    
  forgotPassword: (email: string) => 
    api.post("/auth/forgot_password", { email }),
    
  resetPassword: (token: string, password: string) => 
    api.post("/auth/reset_password", { token, password }),

  me: () => api.get("/auth/me"),
};
