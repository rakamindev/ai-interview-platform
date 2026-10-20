import axios from "axios";

/** Backend error shape: { errors: [{ message }] } */
export function getErrorMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    const msg = e.response?.data?.errors?.[0]?.message;
    if (typeof msg === "string" && msg) return msg;

    if (e.code === "ECONNABORTED" || e.code === "ETIMEDOUT") {
      return "The request timed out. Please check your connection and try again.";
    }
    if (!e.response) {
      return "Cannot reach the server. Please check your connection and try again.";
    }
  }
  return fallback;
}
