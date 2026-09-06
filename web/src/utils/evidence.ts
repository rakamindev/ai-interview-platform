/**
 * Evidence quotes arrive from the portfolio generator already wrapped in
 * quotation marks — PRD-01 §5 shows the model's expected output as
 * `"\"I split the context into...\""`, and the stored JSONB matches. Rendering
 * those values inside another pair of quotes produced `""I put together …""`,
 * which made the most defensible part of a report look malformed.
 *
 * Normalising here rather than at write time keeps existing rows readable
 * without a data migration, and tolerates a generator that stops adding quotes
 * later. The straight pair, both curly pairs, and the typographic single pair
 * are all recognised, because the model has produced each of them.
 */
const WRAPPING_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['"', '"'],
  ["“", "”"],
  ["‘", "’"],
  ["'", "'"],
];

/** Strips one layer of wrapping quotation marks, if present, and trims. */
export function stripWrappingQuotes(raw: string): string {
  let value = raw.trim();

  for (const [open, close] of WRAPPING_PAIRS) {
    // >= open+close, not > it: `""` is a wrapped *empty* quote and must reduce to
    // nothing, while a lone `"` is one character and is not a wrapping pair at all.
    if (value.length >= open.length + close.length && value.startsWith(open) && value.endsWith(close)) {
      value = value.slice(open.length, value.length - close.length).trim();
      break; // one layer only — a quote that legitimately contains quotes keeps them
    }
  }

  return value;
}

/** Renders a stored evidence quote for display, wrapped in typographic quotes. */
export function formatEvidenceQuote(raw: string): string {
  const inner = stripWrappingQuotes(raw);
  return inner.length === 0 ? "" : `“${inner}”`;
}
