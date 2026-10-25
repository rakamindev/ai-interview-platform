import { atom } from "jotai";

export interface TenantState {
  id: string | null;
  name: string | null;
}

const STORAGE_KEY = "current_tenant";

export function getStoredTenant(): TenantState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveTenant(tenant: TenantState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tenant));
  } catch {
    // ignore
  }
}

export function clearTenant(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const defaultTenant: TenantState = {
  id: import.meta.env.VITE_DEV_TENANT_ID ?? null,
  name: import.meta.env.VITE_DEV_TENANT_NAME ?? "Demo Tenant",
};

// Initial state hydrated from localStorage or env fallback
export const tenantAtom = atom<TenantState>(getStoredTenant() ?? defaultTenant);
