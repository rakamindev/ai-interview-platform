import api from "./api";
import type { OrganizationAiConfig, UpdateAiConfigRequest } from "@/types";

export const organizationService = {
  async getAiConfig(): Promise<OrganizationAiConfig> {
    const response = await api.get<{ ai_config: OrganizationAiConfig }>("/organization/ai_config");
    return response.data.ai_config;
  },

  async updateAiConfig(payload: UpdateAiConfigRequest): Promise<OrganizationAiConfig> {
    const response = await api.patch<{ ai_config: OrganizationAiConfig }>("/organization/ai_config", payload);
    return response.data.ai_config;
  },
};
