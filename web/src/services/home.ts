import api from "./api";
import type { HomeDesk } from "@/types/home";

export const homeApi = {
  get: (since?: string | null) => api.get<HomeDesk>("/home", { params: since ? { since } : undefined }),
};
