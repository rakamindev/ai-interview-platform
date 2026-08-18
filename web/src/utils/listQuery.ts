export const API_PER_PAGE_MAX = 100;

export type SessionListStatus =
  | "all"
  | "awaiting"
  | "live"
  | "completed"
  | "failed"
  | "none";

export const SESSION_STATUS_FILTERS: { value: SessionListStatus; label: string }[] = [
  { value: "all", label: "All status" },
  { value: "awaiting", label: "Awaiting" },
  { value: "live", label: "Live" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "none", label: "No session" },
];

export function matchesQuery(value: string | null | undefined, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (value ?? "").toLowerCase().includes(q);
}

export function sessionListStatus(session?: {
  status?: string;
  end_reason?: string | null;
} | null): Exclude<SessionListStatus, "all"> {
  if (!session) return "none";
  if (session.status === "pending") return "awaiting";
  if (session.status === "active") return "live";
  if (session.status === "ended" && session.end_reason === "error") return "failed";
  if (session.status === "ended") return "completed";
  return "none";
}

/** Walk API pages using meta.total_pages so the FE is not capped at a single 100-row fetch. */
export async function collectAllPages<T>(
  fetchPage: (
    page: number,
    perPage: number
  ) => Promise<{ items: T[]; totalPages: number }>
): Promise<T[]> {
  const first = await fetchPage(1, API_PER_PAGE_MAX);
  const totalPages = Math.max(1, first.totalPages || 1);
  const items = [...first.items];
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await fetchPage(page, API_PER_PAGE_MAX);
    items.push(...next.items);
  }
  return items;
}
