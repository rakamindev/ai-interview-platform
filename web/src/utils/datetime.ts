const UTC_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function parse(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Shown in UTC, the same as the PDF, so the screen and the document agree.
export function formatUtc(value: string | Date | null | undefined): string {
  const date = parse(value);
  return date ? `${UTC_FORMAT.format(date)} UTC` : "time not recorded";
}

// The UTC calendar date only, e.g. "25 Oct 2026", for lists.
export function formatDate(value: string | Date | null | undefined): string {
  const date = parse(value);
  return date ? DATE_FORMAT.format(date) : "date not recorded";
}
