import {atom} from "jotai";

export interface TenantState {
    id: string | null;
    name: string | null;
}

const STORAGE_KEY = "tenant_state";

function getDefaultTenant(): TenantState {
    return {
        id: import.meta.env.VITE_DEV_TENANT_ID ?? null,
        name: import.meta.env.VITE_DEV_TENANT_NAME ?? "Demo Tenant",
    };
}

export function getStoredTenant(): TenantState {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
        return getDefaultTenant();
    }

    try {
        const parsed = JSON.parse(raw) as Partial<TenantState>;

        return {
            id: parsed.id ?? null,
            name: parsed.name ?? null,
        };
    } catch {
        return getDefaultTenant();
    }
}

export function saveTenant(tenant: TenantState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tenant));
}

export function clearTenant() {
    localStorage.removeItem(STORAGE_KEY);
}

export const tenantAtom = atom<TenantState>(getStoredTenant());
