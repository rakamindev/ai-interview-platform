
import axios from "axios";

export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const data = error.response?.data as
    | {
        message?: string;
        error?: string;
        errors?: Array<string | { message?: string }>;
      }
    | undefined;

  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    const firstError = data.errors[0];

    if (typeof firstError === "string") {
      return firstError;
    }

    if (firstError?.message) {
      return firstError.message;
    }
  }

  if (data?.message) {
    return data.message;
  }

  if (data?.error) {
    return data.error;
  }

  if (!error.response) {
    return "Unable to connect to the server. Check your connection.";
  }

  return fallback;
}