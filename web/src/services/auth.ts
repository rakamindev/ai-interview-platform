import api from "./api";
import { getTenantScheme } from "@/stores/tenantAtom";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export const authApi = {
  login: (data: LoginPayload, tenantScheme: string = getTenantScheme()) =>
    api.post<LoginResponse>("/auth/login", data, {
      headers: { "X-Tenant-Scheme": tenantScheme },
    }),

  signup: (data: { email: string; password: string; role: "admin" | "user" }) =>
    api.post<LoginResponse>("/signup", data),
};
