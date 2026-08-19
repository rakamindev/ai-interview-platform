function slugify(text: string): string {
  return text.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}

// e.g. "Budi-Flutter-Engineer-Portfolio-2026-08-18.pdf" instead of "portfolio-1.pdf" —
// who was interviewed and for what role, at a glance in the downloads folder.
export function exportFilename(
  candidateName: string | null | undefined,
  roleTitle: string | null | undefined,
  kind: string,
  ext: string
): string {
  const candidate = slugify(candidateName || "Candidate");
  const role = slugify(roleTitle || "Assessment");
  const date = new Date().toISOString().slice(0, 10);
  return `${candidate}-${role}-${kind}-${date}.${ext}`;
}
