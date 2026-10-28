/** The message the API put in its error envelope, or `fallback` for network and unknown errors. */
export function apiErrorMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
  const message = (error as { response?: { data?: { errors?: { message?: string }[] } } })?.response?.data
    ?.errors?.[0]?.message;
  return message || fallback;
}
