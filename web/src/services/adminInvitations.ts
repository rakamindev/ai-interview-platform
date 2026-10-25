import api from "./api";

export type AdminInvitationStatus = "active" | "expired" | "accepted" | "revoked";

export interface AdminInvitation {
  id: string;
  recipient_email: string;
  status: AdminInvitationStatus;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  inviter_email: string;
  organization: {
    id: number;
    name: string;
  };
}

export interface PublicAdminInvitation {
  recipient_email: string;
  expires_at: string;
  organization: {
    name: string;
  };
}

export const adminInvitationsApi = {
  list: () => api.get<{ invitations: AdminInvitation[] }>("/admin_invitations"),
  create: (email: string) =>
    api.post<{ invitation: AdminInvitation; signup_url: string }>("/admin_invitations", { email }),
  revoke: (id: string) =>
    api.post<{ invitation: AdminInvitation }>(`/admin_invitations/${id}/revoke`),
  validate: (invitationToken: string) =>
    api.post<{ invitation: PublicAdminInvitation }>("/auth/admin_invitations/validate", {
      invitation_token: invitationToken,
    }),
};
