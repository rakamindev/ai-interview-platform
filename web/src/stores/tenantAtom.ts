import { atom } from "jotai";

export interface TenantState {
  id: string | null;
  name: string | null;
  scheme?: string | null;
}

const STORAGE_KEY = "tenant_context";

function getInitialTenant(): TenantState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as TenantState;
  } catch {
    // Ignore malformed local development state.
  }

  return {
    id: import.meta.env.VITE_DEV_TENANT_ID ?? null,
    name: import.meta.env.VITE_DEV_TENANT_NAME ?? "Demo Tenant",
    scheme: null,
  };
}

export function saveTenant(tenant: TenantState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tenant));
}

export function clearTenant() {
  localStorage.removeItem(STORAGE_KEY);
}

export const tenantAtom = atom<TenantState>(getInitialTenant());
