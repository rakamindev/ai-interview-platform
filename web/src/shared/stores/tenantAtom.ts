import { atom } from "jotai";

export interface TenantState {
  id: string | null;
  name: string | null;
}

// Dev: seed from env; replace with platform context later
export const tenantAtom = atom<TenantState>({
  id: import.meta.env.VITE_DEV_TENANT_ID ?? null,
  name: import.meta.env.VITE_DEV_TENANT_NAME ?? "Demo Tenant",
});
