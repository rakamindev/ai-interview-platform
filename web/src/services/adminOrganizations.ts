import api from "./api";

export interface CreateOrganizationPayload {
  name: string;
  scheme: string;
  identifier?: string;
  host?: string;
}

export interface AdminOrganization {
  id: number;
  name: string;
  scheme: string;
  identifier: string;
  host: string;
  created_at: string;
}

export const adminOrganizationsApi = {
  list: () =>
    api.get<{ organizations: AdminOrganization[] }>("/admin/organizations"),

  create: (data: CreateOrganizationPayload) =>
    api.post<{ organization: AdminOrganization }>("/admin/organizations", { organization: data }),
};
