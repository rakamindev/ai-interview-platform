import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function extractErrorMessage(e: unknown, fallback: string): string {
    const message = (e as { response?: { data?: { errors?: { message?: string }[] } } })
        ?.response?.data?.errors?.[0]?.message;
    return message ?? fallback;
}
