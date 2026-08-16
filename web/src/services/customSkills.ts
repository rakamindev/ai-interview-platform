import api from "./api";
import type { CustomSkill } from "@/types";

export const customSkillsApi = {
  list: () => api.get<{ custom_skills: CustomSkill[] }>("/custom_skills"),

  create: (payload: Partial<CustomSkill>) =>
    api.post<{ custom_skill: CustomSkill }>("/custom_skills", { custom_skill: payload }),

  destroy: (id: number) => api.delete(`/custom_skills/${id}`),
};
