// Batas alasan koreksi; harus sama dengan AssessorOverrideEvent::REASON_LENGTH di API.
export const OVERRIDE_REASON_MIN = 10;
export const OVERRIDE_REASON_MAX = 1000;

export function isValidOverrideReason(reason: string): boolean {
  const length = reason.trim().length;
  return length >= OVERRIDE_REASON_MIN && length <= OVERRIDE_REASON_MAX;
}

const WIB = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

/** Waktu ditampilkan dalam WIB agar konsisten untuk semua asesor. */
export function formatWib(iso: string): string {
  return `${WIB.format(new Date(iso))} WIB`;
}

interface ApiErrorShape {
  code?: string;
  response?: { status?: number; data?: { errors?: { message?: string }[] } };
}

/**
 * Pesan error yang bisa dipahami asesor:
 * - validasi dari server (422) ditampilkan apa adanya;
 * - timeout / jaringan / error server diganti kalimat yang tidak teknis.
 */
export function apiErrorMessage(error: unknown): string {
  const err = (error ?? {}) as ApiErrorShape;
  const status = err.response?.status;
  const serverMessage = err.response?.data?.errors?.[0]?.message;

  if (status && status >= 400 && status < 500 && serverMessage) return serverMessage;
  if (err.code === "ECONNABORTED" || !err.response) {
    return "The request took too long or the connection dropped. Check your connection and try again.";
  }
  return "Something went wrong on our side. Your correction was not saved. Please try again.";
}
