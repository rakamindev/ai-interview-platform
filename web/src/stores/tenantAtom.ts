import { atom } from "jotai";

export interface TenantState {
  id: number | null;
  name: string | null;
}

const TENANT_KEY = "auth_tenant";

function getStoredTenant(): TenantState {
  try {
    const raw = localStorage.getItem(TENANT_KEY);
    return raw ? JSON.parse(raw) : { id: null, name: null };
  } catch {
    return { id: null, name: null };
  }
}

export function saveTenant(tenant: TenantState) {
  localStorage.setItem(TENANT_KEY, JSON.stringify(tenant));
}

export function clearTenant() {
  localStorage.removeItem(TENANT_KEY);
}

export const tenantAtom = atom<TenantState>(getStoredTenant());
