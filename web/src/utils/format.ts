export function formatRate(rate?: number | null) {
  return rate == null ? "—" : `${rate}%`;
}

export function formatDuration(seconds?: number | null) {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}