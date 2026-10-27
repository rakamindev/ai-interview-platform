const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** User-facing date, e.g. "27 Oct 2026". Day-first with a month name so it reads the same in every locale. */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}
