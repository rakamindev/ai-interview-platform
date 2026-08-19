import api from "./api";
import type { OrganizationInfo } from "./auth";

export const organizationApi = {
  get: () => api.get<{ organization: OrganizationInfo }>("/organization"),
  update: (data: Partial<OrganizationInfo>) =>
    api.put<{ organization: OrganizationInfo }>("/organization", { organization: data }),
};
