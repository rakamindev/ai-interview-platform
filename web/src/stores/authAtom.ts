import { atom } from "jotai";
import { roleFromToken } from "@/lib/jwt";

const TOKEN_KEY = "auth_token";
const EMAIL_KEY = "auth_email";

export interface AuthState {
    token: string | null;
    /** "admin" (assessor superuser) or "user" (candidate); null when unknown. */
    role: string | null;
    /** Only populated right after login (the JWT carries no email claim). */
    email: string | null;
}

export function getStoredToken(): string | null {
    return localStorage.getItem(TOKEN_KEY) ?? import.meta.env.VITE_DEV_TOKEN ?? null;
}

export function saveToken(token: string, email?: string) {
    localStorage.setItem(TOKEN_KEY, token);
    if (email) localStorage.setItem(EMAIL_KEY, email);
}

export function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
}

function initialState(): AuthState {
    const token = getStoredToken();
    return {
        token,
        role: roleFromToken(token),
        email: localStorage.getItem(EMAIL_KEY),
    };
}

export const authAtom = atom<AuthState>(initialState());
