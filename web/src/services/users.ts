import api from "./api";
import type { AuthUser } from "@/stores/authAtom";
import type { PaginationMeta } from "@/types";

export interface ManagedUser {
  id: number;
  email: string;
  role: "admin" | "assessor";
  created_at?: string;
}

export interface UserListParams {
  page?: number;
  per_page?: number;
  q?: string;
  role?: "admin" | "assessor";
  sort?: "newest" | "oldest" | "name";
}

export const usersApi = {
  list: (params: UserListParams = {}) =>
    api.get<{ users: ManagedUser[]; meta: PaginationMeta }>("/users", { params }),

  create: (payload: { email: string; password: string; role: AuthUser["role"] }) =>
    api.post<{ user: ManagedUser; message: string }>("/users", { user: payload }),
};
