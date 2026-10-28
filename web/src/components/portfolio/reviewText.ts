import { classifyApiError, validationMessage } from "@/utils/apiError";
import type { LevelSource, NotAssessedReason } from "@/types";

// Shared wording for the portfolio review UI.
export const NOT_ASSESSED_MESSAGES: Record<NotAssessedReason, string> = {
  not_covered: "Not covered in the interview. Probe this skill in the next interview.",
  no_level_from_model: "The AI did not return a rating. Review the transcript or rate manually.",
  invalid_level_from_model: "The AI returned an unusable rating. Review the transcript or rate manually.",
  no_evidence: "No candidate quote supports a rating. Review the transcript or rate manually.",
};

export function levelText(level: number | null | undefined): string {
  return level ? `L${level}` : "Not assessed";
}

export function sourceText(source: LevelSource | null): string {
  if (source === "assessor_override") return "assessor override";
  if (source === "assessor_confirmed") return "confirmed by assessor";
  if (source === "ai") return "AI";
  return "not assessed";
}

// A validation message from the API (422), or a plain-language failure.
export function saveErrorText(error: unknown, action: string): string {
  const validation = validationMessage(error);
  if (validation) return validation;
  return classifyApiError(error).kind === "network"
    ? `${action}. Check your connection and try again.`
    : `${action}. The server had a problem; try again.`;
}
