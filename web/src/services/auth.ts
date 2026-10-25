import api from "./api";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UserSummary {
  id: number;
  email: string;
  role: string;
}

export interface ActiveOrganization {
  id: number;
  name: string;
  scheme: string;
}

export interface OrganizationSummary {
  id: number;
  name: string;
  scheme: string;
  role: string;
}

export interface AuthResponse {
  token: string;
  user: UserSummary;
  active_organization: ActiveOrganization | null;
  organizations: OrganizationSummary[];
}

export interface SwitchTenantResponse {
  token: string;
  active_organization: ActiveOrganization;
  role: string;
}

export interface OrganizationMember {
  id: number;
  user_id: number;
  email: string;
  role: "admin" | "assessor";
  joined_at?: string;
  created_at?: string;
}

export const authApi = {
  login: (data: LoginPayload) =>
    api.post<AuthResponse>("/auth/login", data),

  signupOrganization: (data: { organization_name: string; email: string; password: string }) =>
    api.post<AuthResponse>("/auth/signup/organization", data),

  signupUser: (data: { email: string; password: string }) =>
    api.post<AuthResponse>("/auth/signup/user", data),

  switchTenant: (organization_id: number) =>
    api.post<SwitchTenantResponse>("/auth/switch_tenant", { organization_id }),

  // Organization team members API
  getMembers: () =>
    api.get<{ members: OrganizationMember[] }>("/organization/members"),

  inviteMember: (data: { email: string; role?: "admin" | "assessor" }) =>
    api.post<{ member: OrganizationMember; message: string }>("/organization/members/invite", data),

  removeMember: (membershipId: number) =>
    api.delete<{ message: string }>(`/organization/members/${membershipId}`),

  // Backward compatibility alias
  signup: (data: { email: string; password: string; role?: "admin" | "user"; organization_name?: string }) =>
    api.post<AuthResponse>("/auth/signup", data),
};
