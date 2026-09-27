import api from "./api";

export interface CreateUserPayload {
  email: string;
  password: string;
  password_confirmation?: string;
  role: "admin" | "assessor";
  organization_id?: number | null;
}

export interface AdminUser {
  id: number;
  email: string;
  role: "admin" | "assessor";
  organization_id?: number | null;
  organization_name?: string | null;
  organization_scheme?: string | null;
  created_at: string;
}

export const adminUsersApi = {
  list: (params?: { role?: string; organization_id?: number }) =>
    api.get<{ users: AdminUser[] }>("/admin/users", { params }),

  create: (data: CreateUserPayload) =>
    api.post<{ user: AdminUser }>("/admin/users", { user: data }),
};
