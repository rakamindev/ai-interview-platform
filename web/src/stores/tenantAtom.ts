import { atom } from "jotai";

export interface TenantState {
  id: number | string | null;
  name: string | null;
  scheme: string | null;
  role?: string | null;
}

const STORAGE_KEY = "auth_active_org";

export function getStoredActiveOrg(): TenantState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore JSON parse errors
  }
  return {
    id: import.meta.env.VITE_DEV_TENANT_ID ?? null,
    name: import.meta.env.VITE_DEV_TENANT_NAME ?? null,
    scheme: null,
  };
}

export function saveActiveOrg(org: TenantState | null) {
  if (org) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(org));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const tenantAtom = atom<TenantState>(getStoredActiveOrg());
