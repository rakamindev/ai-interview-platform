import { describe, it, expect } from "vitest";
import { deriveColumn, type PipelineSession } from "./pipeline";

describe("deriveColumn (Kanban Pipeline Logic)", () => {
  const baseSession: PipelineSession = {
    id: 1,
    assessment_id: 10,
    assessment_name: "Frontend Engineer",
    candidate_name: "Alice",
    status: "pending",
    end_reason: null,
    pipeline_stage: null,
    started_at: null,
    ended_at: null,
    duration_seconds: null,
    created_at: "2026-10-28T10:00:00Z",
  };

  describe("Manual pipeline_stage precedence (Overrides auto-derived)", () => {
    it("returns 'shortlisted' when pipeline_stage is shortlisted regardless of status", () => {
      expect(deriveColumn({ ...baseSession, pipeline_stage: "shortlisted", status: "pending" })).toBe("shortlisted");
      expect(deriveColumn({ ...baseSession, pipeline_stage: "shortlisted", status: "active" })).toBe("shortlisted");
      expect(deriveColumn({ ...baseSession, pipeline_stage: "shortlisted", status: "ended" })).toBe("shortlisted");
    });

    it("returns 'hired' when pipeline_stage is hired regardless of status", () => {
      expect(deriveColumn({ ...baseSession, pipeline_stage: "hired", status: "pending" })).toBe("hired");
      expect(deriveColumn({ ...baseSession, pipeline_stage: "hired", status: "active" })).toBe("hired");
      expect(deriveColumn({ ...baseSession, pipeline_stage: "hired", status: "ended" })).toBe("hired");
    });

    it("returns 'rejected' when pipeline_stage is rejected regardless of status", () => {
      expect(deriveColumn({ ...baseSession, pipeline_stage: "rejected", status: "pending" })).toBe("rejected");
      expect(deriveColumn({ ...baseSession, pipeline_stage: "rejected", status: "ended" })).toBe("rejected");
    });
  });

  describe("Auto-derived columns when pipeline_stage is null", () => {
    it("returns 'invited' for pending sessions", () => {
      expect(deriveColumn({ ...baseSession, status: "pending" })).toBe("invited");
    });

    it("returns 'interviewing' for active sessions", () => {
      expect(deriveColumn({ ...baseSession, status: "active" })).toBe("interviewing");
    });

    it("returns 'evaluated' for cleanly ended sessions", () => {
      expect(deriveColumn({ ...baseSession, status: "ended", end_reason: "all_covered" })).toBe("evaluated");
      expect(deriveColumn({ ...baseSession, status: "ended", end_reason: "manual_candidate" })).toBe("evaluated");
      expect(deriveColumn({ ...baseSession, status: "ended", end_reason: "time_ceiling" })).toBe("evaluated");
      expect(deriveColumn({ ...baseSession, status: "ended", end_reason: null })).toBe("evaluated");
    });

    it("handles error or failed sessions with fallback to evaluated column", () => {
      expect(deriveColumn({ ...baseSession, status: "ended", end_reason: "error" })).toBe("evaluated");
      expect(deriveColumn({ ...baseSession, status: "failed" })).toBe("evaluated");
    });
  });
});
