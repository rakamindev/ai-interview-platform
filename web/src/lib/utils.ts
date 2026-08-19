import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function getErrorMessage(err: any, fallback = "An unexpected error occurred."): string {
    const data = err?.response?.data;
    if (!data) {
        return err?.message || fallback;
    }

    if (typeof data === "string") return data;

    // Standard API format: { errors: [{ status: 422, message: "Email has already been taken" }] }
    if (Array.isArray(data.errors) && data.errors.length > 0) {
        const first = data.errors[0];
        if (typeof first === "string") return first;
        if (first && typeof first === "object" && first.message) return first.message;
    }

    if (typeof data.error === "string") return data.error;
    if (typeof data.message === "string") return data.message;
    if (Array.isArray(data.error) && data.error.length > 0) return String(data.error[0]);

    return fallback;
}

