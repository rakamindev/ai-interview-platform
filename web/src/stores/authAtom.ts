import { atom } from "jotai";
import { UserSummary, OrganizationSummary } from "@/services/auth";

export interface AuthState {
  token: string | null;
  user: UserSummary | null;
  organizations: OrganizationSummary[];
}

const STORAGE_KEY = "auth_token";
const USER_KEY = "auth_user";
const ORGS_KEY = "auth_organizations";

export function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_KEY) ?? import.meta.env.VITE_DEV_TOKEN ?? null;
}

export function getStoredUser(): UserSummary | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getStoredOrganizations(): OrganizationSummary[] {
  try {
    const raw = localStorage.getItem(ORGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAuthSession(data: {
  token: string;
  user?: UserSummary | null;
  organizations?: OrganizationSummary[];
}) {
  localStorage.setItem(STORAGE_KEY, data.token);
  if (data.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }
  if (data.organizations) {
    localStorage.setItem(ORGS_KEY, JSON.stringify(data.organizations));
  }
}

export function saveToken(token: string) {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ORGS_KEY);
  localStorage.removeItem("auth_active_org");
}

export const authAtom = atom<AuthState>({
  token: getStoredToken(),
  user: getStoredUser(),
  organizations: getStoredOrganizations(),
});
