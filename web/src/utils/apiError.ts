type ApiErrorPayload = {
  response?: { data?: { errors?: Array<{ message?: string }> } };
};

export function getApiErrorMessage(err: unknown, fallback: string): string {
  return (
    (err as ApiErrorPayload | undefined)?.response?.data?.errors?.[0]
      ?.message ?? fallback
  );
}
