import { atom } from "jotai";
import type { AuthUser, OrganizationInfo } from "@/services/auth";

export interface UserState {
  user: AuthUser | null;
  organization: OrganizationInfo | null;
  loaded: boolean;
}

export const userAtom = atom<UserState>({
  user: null,
  organization: null,
  loaded: false,
});
