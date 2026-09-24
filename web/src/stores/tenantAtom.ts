import { atom } from "jotai";

export const DEFAULT_TENANT_SCHEME = "test-corp";
const TENANT_SCHEME_STORAGE_KEY = "tenant_scheme";

export function getTenantScheme(): string {
  return (
    localStorage.getItem(TENANT_SCHEME_STORAGE_KEY) ??
    import.meta.env.VITE_TENANT_SCHEME ??
    DEFAULT_TENANT_SCHEME
  );
}

export function saveTenantScheme(scheme: string = DEFAULT_TENANT_SCHEME) {
  localStorage.setItem(TENANT_SCHEME_STORAGE_KEY, scheme || DEFAULT_TENANT_SCHEME);
}

export interface TenantState {
  id: string | null;
  name: string | null;
}

// Dev: seed from env; replace with platform context later
export const tenantAtom = atom<TenantState>({
  id: import.meta.env.VITE_DEV_TENANT_ID ?? null,
  name: import.meta.env.VITE_DEV_TENANT_NAME ?? "Demo Tenant",
});
