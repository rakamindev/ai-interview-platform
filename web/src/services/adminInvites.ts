import api from "./api";
import type { AdminInvite, PaginationMeta } from "@/types";

export const adminInvitesApi = {
  list: (page = 1, q?: string) =>
    api.get<{ admin_invites: AdminInvite[]; meta: PaginationMeta }>("/admin_invites", {
      params: { page, ...(q ? { q } : {}) },
    }),

  create: (email: string, role: "admin" | "assessor") =>
    api.post<{ admin_invite: AdminInvite }>("/admin_invites", { admin_invite: { email, role } }),

  show: (token: string) =>
    api.get<{ email: string; role: string }>(`/admin_invites/${token}`),

  accept: (token: string, password: string, passwordConfirmation: string) =>
    api.post<{ message: string }>(`/admin_invites/${token}/accept`, {
      password,
      password_confirmation: passwordConfirmation,
    }),
};
