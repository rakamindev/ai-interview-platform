export function apiErrorMessages(error: any, fallback: string): string[] {
  const errors = error?.response?.data?.errors;
  if (!Array.isArray(errors)) return [fallback];

  const messages = errors
    .map((item) => item?.message)
    .filter((message): message is string => typeof message === "string" && message.trim().length > 0);

  return messages.length ? messages : [fallback];
}
