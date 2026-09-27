import { Session } from "@/types";

export function formatSessionDate(date?: string | null) {
  if (!date) return "Not started";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(parsed);
}

// HR selects a calendar date and clock time in Asia/Jakarta (UTC+07:00).
// Converting an explicit offset avoids interpreting the date in the browser's timezone.
export function customExpirationIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const parsed = new Date(`${date}T${time}:00+07:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  // Reject impossible dates that JavaScript normalizes, such as February 30.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(parsed);
  const part = (name: string) => parts.find((item) => item.type === name)?.value;
  if (`${part("year")}-${part("month")}-${part("day")}` !== date ||
      `${part("hour")}:${part("minute")}` !== time) return null;
  return parsed.toISOString();
}

export function todayWib(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (name: string) => parts.find((item) => item.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isExpired(session: Session): boolean {
  return session.status === "pending" &&
    (session.invitation_expired === true ||
      Boolean(session.expires_at && new Date(session.expires_at).getTime() <= Date.now()));
}

export function formatExpiryWib(value?: string | null): string {
  if (!value) return "Not configured";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(parsed) + " WIB";
}
