import { atom } from "jotai";

export interface TenantState {
  id: string | null;
  name: string | null;
}

// Populated from the login response (the real organization) — never from env.
export const tenantAtom = atom<TenantState>({
  id: null,
  name: null,
});
