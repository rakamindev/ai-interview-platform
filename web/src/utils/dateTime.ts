/**
 * Parses an ISO string or database timestamp into a Date object.
 * If the string lacks timezone information, interprets it as UTC to avoid local timezone drift.
 */
export function parseIsoDate(dateInput: string | number | Date | null | undefined): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;
  if (typeof dateInput === "number") {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
  }

  let str = String(dateInput).trim();
  // Normalize SQL "YYYY-MM-DD HH:MM:SS" to ISO "YYYY-MM-DDTHH:MM:SS"
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(str)) {
    str = str.replace(" ", "T");
  }

  // If missing timezone designator, append Z to ensure UTC interpretation
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(str)) {
    str += "Z";
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/** Formats a timestamp into localized Date and Time (e.g. "Oct 17, 2026, 03:15 AM") */
export function formatDateTime(
  dateInput: string | number | Date | null | undefined,
  locale?: string
): string {
  const d = parseIsoDate(dateInput);
  if (!d) return "—";

  return d.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formats a timestamp into localized Date only (e.g. "Oct 17, 2026") */
export function formatDate(
  dateInput: string | number | Date | null | undefined,
  locale?: string
): string {
  const d = parseIsoDate(dateInput);
  if (!d) return "—";

  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Formats a timestamp into localized Time only (e.g. "03:15:20" or "03:15") */
export function formatTime(
  dateInput: string | number | Date | null | undefined,
  locale?: string,
  includeSeconds = false
): string {
  const d = parseIsoDate(dateInput);
  if (!d) return "—";

  return d.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" } : {}),
  });
}
