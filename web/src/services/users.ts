import api from "./api";
import type { AuthUser, UserRole } from "./auth";

export interface UserCreatePayload {
  email: string;
  password: string;
  role: UserRole;
}

export interface UserUpdatePayload {
  role?: UserRole;
  password?: string;
}

export const usersApi = {
  list: () => api.get<{ users: (AuthUser & { created_at?: string; updated_at?: string })[] }>("/users"),
  create: (data: UserCreatePayload) => api.post<{ user: AuthUser }>("/users", data),
  update: (id: number, data: UserUpdatePayload) => api.put<{ user: AuthUser }>(`/users/${id}`, data),
  delete: (id: number) => api.delete<{ message: string }>(`/users/${id}`),
};
