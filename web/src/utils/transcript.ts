/**
 * Sanitizes transcript text by stripping leaked internal metadata and coverage maps.
 * Provides defense-in-depth protection on the frontend.
 */
export function cleanTranscriptText(text: string): string {
  if (!text) return "";

  return text
    .replace(/\[COVERAGE[_ ]MAP\][\s\S]*?\[\/COVERAGE[_ ]MAP\]/gi, "")
    .replace(/\[COVERAGE[_ ]MAP[^\]]*\]/gi, "")
    .replace(/\{\s*"skills"\s*:[\s\S]*?"discovered"[\s\S]*?\}\s*/gi, "")
    .replace(/\{\s*"skills"\s*:[\s\S]*?\]\s*\}\s*/gi, "")
    .replace(/\[TIME[_ ]CONTROL[^\]]*\]/gi, "")
    .replace(/\[SESSION RESUME\]/gi, "")
    .replace(/\[Start the interview[^\]]*\]/gi, "")
    .trim();
}
