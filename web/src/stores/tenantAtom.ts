import { atom } from "jotai";

export interface TenantState {
  id: string | null;
  name: string | null;
}

// Real state comes from the login response (see LoginPage). The
// VITE_DEV_TENANT_* seed is a local dev-server convenience for exercising
// screens before logging in, so it's dead-code-eliminated from production
// builds via import.meta.env.DEV.
export const tenantAtom = atom<TenantState>({
  id: (import.meta.env.DEV && import.meta.env.VITE_DEV_TENANT_ID) || null,
  name: (import.meta.env.DEV && import.meta.env.VITE_DEV_TENANT_NAME) || null,
});
