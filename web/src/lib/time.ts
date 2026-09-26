// Times come from the API in UTC. The desk shows them in WIB, and says so.
const ZONE = "Asia/Jakarta";

export function greeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: ZONE }).format(now));
  if (hour >= 4 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

export function longDate(now: Date): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: ZONE }).format(now);
}

export function clockTime(date: Date): string {
  return `${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: ZONE }).format(date)} WIB`;
}

export function relativeTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "at an unknown time";
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function duration(seconds: number | null): string {
  if (seconds == null) return "an unknown time";
  if (seconds < 60) return `${seconds} s`;
  return `${Math.round(seconds / 60)} min`;
}
