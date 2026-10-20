/**
 * Reads the HTTP status from a rejected request without trusting its shape.
 *
 * Axios rejects with an untyped error, so narrow it at runtime instead of
 * asserting a response shape we never validated.
 */
export function httpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("response" in error)) {
    return undefined;
  }

  const { response } = error;
  if (!response || typeof response !== "object" || !("status" in response)) {
    return undefined;
  }

  const { status } = response;
  return typeof status === "number" ? status : undefined;
}

/**
 * Reads the first API validation message (`errors[0].message`) without
 * asserting a payload shape the client never validated.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object" || !("response" in error)) {
    return fallback;
  }

  const { response } = error;
  if (!response || typeof response !== "object" || !("data" in response)) {
    return fallback;
  }

  const { data } = response;
  if (!data || typeof data !== "object" || !("errors" in data)) {
    return fallback;
  }

  const { errors } = data;
  if (!Array.isArray(errors)) {
    return fallback;
  }

  const message = (errors[0] as { message?: unknown } | undefined)?.message;
  return typeof message === "string" && message.trim() !== "" ? message : fallback;
}
