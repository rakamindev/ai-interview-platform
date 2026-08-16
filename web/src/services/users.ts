import api from "./api";
import type { AuthUser } from "@/stores/authAtom";

export interface ManagedUser {
  id: number;
  email: string;
  role: "admin" | "assessor";
  created_at?: string;
}

export const usersApi = {
  list: () => api.get<{ users: ManagedUser[] }>("/users"),

  create: (payload: { email: string; password: string; role: AuthUser["role"] }) =>
    api.post<{ user: ManagedUser; message: string }>("/users", { user: payload }),
};
