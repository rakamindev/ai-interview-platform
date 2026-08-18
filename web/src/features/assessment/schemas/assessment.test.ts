import { describe, expect, it } from "vitest";
import * as v from "valibot";

import { assessmentSchema, createAssessmentSchema, latestSessionSchema } from "./assessment";

describe("latestSessionSchema", () => {
  it("accepts a valid ended session", () => {
    const input = { id: 1, status: "ended", end_reason: "all_covered" };
    expect(v.safeParse(latestSessionSchema, input).success).toBe(true);
  });

  it("rejects an unknown end_reason", () => {
    const input = { id: 1, status: "ended", end_reason: "unknown" };
    expect(v.safeParse(latestSessionSchema, input).success).toBe(false);
  });
});

describe("assessmentSchema", () => {
  it("accepts a valid assessment", () => {
    const input = {
      id: 1,
      name: "Backend Interview",
      time_limit_min: 60,
      language: "en",
      system_prompt: "",
      created_by: 1,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      skills_count: 2,
      candidates_count: 0,
      latest_session: null,
    };
    expect(v.safeParse(assessmentSchema, input).success).toBe(true);
  });

  it("rejects an invalid language", () => {
    const input = {
      id: 1,
      name: "Backend Interview",
      time_limit_min: 60,
      language: "de",
      system_prompt: "",
      created_by: 1,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      skills_count: 2,
      candidates_count: 0,
      latest_session: null,
    };
    expect(v.safeParse(assessmentSchema, input).success).toBe(false);
  });
});

describe("createAssessmentSchema", () => {
  const baseSkill = {
    skill_label: "Ruby",
    skill_id: "sk-ruby",
    expected_level: 3,
    is_custom: false,
    display_order: 0,
    scope_include: "x",
    scope_exclude: "y",
    l1_anchor: "a",
    l2_anchor: "b",
    l3_anchor: "c",
    l4_anchor: "d",
    l5_anchor: "e",
  };

  it("accepts an assessment with at least one skill", () => {
    const input = {
      name: "Backend Interview",
      time_limit_min: 60,
      language: "en",
      assessment_skills_attributes: [baseSkill],
    };
    expect(v.safeParse(createAssessmentSchema, input).success).toBe(true);
  });

  it("rejects an assessment with no skills", () => {
    const input = {
      name: "Backend Interview",
      time_limit_min: 60,
      language: "en",
      assessment_skills_attributes: [],
    };
    expect(v.safeParse(createAssessmentSchema, input).success).toBe(false);
  });

  it("accepts multiple skills with numeric expected levels", () => {
    const input = {
      name: "Backend Interview",
      time_limit_min: 60,
      language: "en",
      assessment_skills_attributes: [
        baseSkill,
        { ...baseSkill, skill_label: "PostgreSQL", skill_id: "sk-pg", expected_level: 4 },
      ],
    };
    expect(v.safeParse(createAssessmentSchema, input).success).toBe(true);
  });

  it("rejects a non-numeric expected level", () => {
    const input = {
      name: "Backend Interview",
      time_limit_min: 60,
      language: "en",
      assessment_skills_attributes: [{ ...baseSkill, expected_level: "senior" }],
    };
    expect(v.safeParse(createAssessmentSchema, input).success).toBe(false);
  });
});