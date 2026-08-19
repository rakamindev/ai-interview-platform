import api, { parseResponse } from "./api";
import {
  SessionSchema,
  CoverageMapSchema,
  TranscriptTurnSchema,
  CandidateInfoSchema
} from "@/schemas/session";
import { PortfolioSchema } from "@/schemas/portfolio";
import type { Session, CoverageMap, TranscriptTurn, Portfolio, CandidateInfo } from "@/types";

const EMPTY_SESSION: Session = {
  id: 0,
  assessment_id: 0,
  invite_token: "",
  invite_url: "",
  status: "pending"
};

export const sessionsApi = {
  get: (id: number) =>
    api.get(`/sessions/${id}`).then((res) => {
      const raw = res.data as any;
      return {
        ...res,
        data: {
          session: parseResponse(raw?.session, SessionSchema, EMPTY_SESSION),
          assessment: raw?.assessment ?? { id: 0, name: "", time_limit_min: 0 }
        }
      };
    }),

  endSession: (id: number, reason = "manual_assessor") =>
    api.post<{ session: Session }>(`/sessions/${id}/end_session`, {
      session: { reason }
    }),

  getCoverage: (id: number) =>
    api.get(`/sessions/${id}/coverage`).then((res) => ({
      ...res,
      data: parseResponse(res.data, CoverageMapSchema, { skills: [], discovered: [] })
    })),

  getTranscript: (id: number, fromTurn?: number) =>
    api
      .get(`/sessions/${id}/transcript`, {
        params: fromTurn ? { from_turn: fromTurn } : undefined
      })
      .then((res) => {
        const raw = res.data as any;
        return {
          ...res,
          data: {
            turns: Array.isArray(raw?.turns)
              ? raw.turns
                  .map((t: unknown) => parseResponse(t, TranscriptTurnSchema, null))
                  .filter(Boolean)
              : [],
            total: raw?.total ?? 0
          }
        };
      }),

  getPortfolio: (id: number) =>
    api.get(`/sessions/${id}/portfolio`).then((res) => {
      const raw = res.data as any;
      if (raw?.portfolio) {
        return {
          ...res,
          data: { portfolio: parseResponse(raw.portfolio, PortfolioSchema, null) }
        };
      }
      return { ...res, data: { status: raw?.status ?? "pending" } };
    }),

  regeneratePortfolio: (id: number) =>
    api.post(`/sessions/${id}/portfolio/regenerate`).then((res) => {
      const raw = res.data as any;
      return {
        ...res,
        data: {
          message: raw?.message ?? "",
          portfolio: parseResponse(raw?.portfolio, PortfolioSchema, null)
        }
      };
    }),

  getCandidateInfo: (token: string) =>
    api.get(`/sessions/${token}/candidate`).then((res) => ({
      ...res,
      data: parseResponse(res.data, CandidateInfoSchema, {
        session_id: 0,
        role_title: "",
        time_limit_min: 0,
        session_status: ""
      })
    })),

  audioComplete: (token: string) =>
    api.post<{ ended: boolean; message: string }>(`/sessions/${token}/audio_complete`)
};
