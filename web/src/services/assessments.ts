
import api from "./api";

import type {
  Assessment,
  AssessmentSkill,
  PaginationMeta,
  Session,
} from "@/types";

export interface AssessmentPayload {
  name: string;
  time_limit_min: number;
  language?: "en" | "id";
  assessment_skills_attributes: Partial<AssessmentSkill>[];
}

export interface AssessmentSessionCounts {
  total: number;
  by_status: Record<string, number>;
}

export interface AssessmentsMeta extends PaginationMeta {
  session_counts?: AssessmentSessionCounts;
}

export interface AssessmentsListResponse {
  assessments: Assessment[];
  meta: AssessmentsMeta;
}

export interface CandidateSessionCounts {
  total: number;
  pending: number;
  active: number;
  completed: number;
  failed: number;
  by_status: Record<string, number>;
}

export interface CandidateSessionsMeta extends PaginationMeta {
  session_counts?: CandidateSessionCounts;
}

export interface SessionInvitationOptions {
  candidateEmail?: string;
  expirationDays?: 1 | 3 | 7;
  expiresAt?: string;
}

export const assessmentsApi = {
  list: (page = 1, q = "") =>
    api.get<AssessmentsListResponse>(
      "/assessments",
      {
        params: {
          page,
          q: q || undefined,
        },
      }
    ),

  get: (id: number) =>
    api.get<{
      assessment: Assessment;
    }>(
      `/assessments/${id}`
    ),

  create: (data: AssessmentPayload) =>
    api.post<{
      assessment: Assessment;
      system_prompt_generated: boolean;
    }>(
      "/assessments",
      {
        assessment: data,
      }
    ),

  update: (
    id: number,
    data: AssessmentPayload
  ) =>
    api.put<{
      assessment: Assessment;
      system_prompt_generated: boolean;
    }>(
      `/assessments/${id}`,
      {
        assessment: data,
      }
    ),

  delete: (id: number) =>
    api.delete(
      `/assessments/${id}`
    ),

  getSessions: (
    assessmentId: number,
    page = 1,
    q = ""
  ) =>
    api.get<{
      sessions: Session[];
      meta: CandidateSessionsMeta;
    }>(
      `/assessments/${assessmentId}/sessions`,
      {
        params: {
          page,
          q: q || undefined,
        },
      }
    ),

  createSession: (
    assessmentId: number,
    candidateName?: string,
    candidateId?: number,
    options: SessionInvitationOptions = {}
  ) =>
    api.post<{
      session: Session;
      invite_url: string;
    }>(
      `/assessments/${assessmentId}/sessions`,
      {
        session: {
          candidate_name: candidateName,
          candidate_id: candidateId,
          candidate_email: options.candidateEmail,

          ...(options.expiresAt
            ? {
                expires_at: options.expiresAt,
              }
            : {
                expiration_days:
                  options.expirationDays ?? 3,
              }),
        },
      }
    ),
};
