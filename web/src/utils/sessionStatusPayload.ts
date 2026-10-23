const SESSION_STATUSES = [
  "pending",
  "active",
  "ended",
  "failed",
] as const;

const END_REASONS = [
  "manual_candidate",
  "manual_assessor",
  "all_covered",
  "time_ceiling",
  "error",
] as const;

export type SessionStatus = (typeof SESSION_STATUSES)[number];
export type SessionEndReason = (typeof END_REASONS)[number];

export interface SessionStatusPayload {
  status: SessionStatus;
  end_reason: SessionEndReason | null;
}

export function parseSessionStatus(
  value: unknown,
): SessionStatusPayload | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  if (!("type" in value) || value.type !== "session_status") {
    return null;
  }

  if (
    !("status" in value) ||
    typeof value.status !== "string" ||
    !SESSION_STATUSES.includes(value.status as SessionStatus)
  ) {
    return null;
  }

  if (!("end_reason" in value)) {
    return null;
  }

  const endReason = value.end_reason;

  if (
    endReason !== null &&
    (typeof endReason !== "string" ||
      !END_REASONS.includes(endReason as SessionEndReason))
  ) {
    return null;
  }

  return {
    status: value.status as SessionStatus,
    end_reason: endReason as SessionEndReason | null,
  };
}
