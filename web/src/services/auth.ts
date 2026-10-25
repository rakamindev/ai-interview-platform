import api from "./api";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  invitation_token: string;
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export const authApi = {
  // F-03 phase 2 (decision evolution A → D): login is tenant-implicit —
  // email + password only. The tenant scheme is derived server-side from the
  // account's organization, so no X-Tenant-Scheme header is sent.
  login: (data: LoginPayload) => api.post<LoginResponse>("/auth/login", data),

  // Administrator signup is authorized by a server-issued invitation. Tenant
  // and role are intentionally absent from the client contract.
  signup: (data: SignupPayload) => api.post<LoginResponse>("/auth/signup", data),
};
