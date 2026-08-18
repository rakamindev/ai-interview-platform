import { describe, it, expect, vi } from "vitest";

// jsdom@30 does not provide localStorage — mock before any import triggers authAtom
vi.hoisted(() => {
  const store = new Map<string, string>();
  const localStorageMock = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
  };
  Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, configurable: true });
});

import { parseResponse } from "../services/api";
import { SkillComparisonSchema } from "./comparison";
import { PortfolioSchema } from "./portfolio";
import { VacancySchema } from "./vacancy";

describe("parseResponse", () => {
  it("returns data when schema matches", () => {
    const data = { skill_label: "React", expected_level: 3, result: "match" };
    const result = parseResponse(data, SkillComparisonSchema, null as any);
    expect(result.skill_label).toBe("React");
    expect(result.expected_level).toBe(3);
  });

  it("allows unknown keys (lenient parse)", () => {
    const data = {
      skill_label: "React",
      expected_level: 3,
      result: "match",
      extra_field: "should be ignored",
    };
    const result = parseResponse(data, SkillComparisonSchema, null as any);
    expect(result.skill_label).toBe("React");
  });

  it("degrades to fallback when required field is missing", () => {
    const data = { skill_label: "React" }; // missing expected_level, result
    const fallback = { skill_label: "", expected_level: 0, result: "not_assessed" as const };
    const result = parseResponse(data, SkillComparisonSchema, fallback);
    expect(result).toEqual(fallback);
  });

  it("rejects required_level payload (engine sends expected_level)", () => {
    const data = {
      skill_label: "React",
      required_level: 3,
      result: "match",
    };
    const fallback = { skill_label: "", expected_level: 0, result: "not_assessed" as const };
    const result = parseResponse(data, SkillComparisonSchema, fallback);
    // required_level is not in schema → data is missing expected_level → falls back
    expect(result).toEqual(fallback);
  });

  it("parses portfolio with numeric ai_level", () => {
    const data = {
      id: 1,
      session_id: 1,
      generation_status: "complete",
      skills: [
        {
          id: 1,
          skill_label: "React",
          is_discovered: true,
          ai_level: 3,
          ai_confidence: "high",
          evidence: ["coded component"],
          competency_summary: "Strong",
        },
      ],
      overrides: [],
    };
    const result = parseResponse(data, PortfolioSchema, null as any);
    expect(result.skills[0].ai_level).toBe(3);
  });

  it("rejects string ai_level (old format 'L3')", () => {
    const data = {
      id: 1,
      session_id: 1,
      generation_status: "complete",
      skills: [
        {
          id: 1,
          skill_label: "React",
          is_discovered: true,
          ai_level: "L3", // wrong: string instead of number
          ai_confidence: "high",
          evidence: [],
          competency_summary: "",
        },
      ],
      overrides: [],
    };
    const fallback = {
      id: 0,
      session_id: 0,
      generation_status: "pending" as const,
      skills: [],
      overrides: [],
    };
    const result = parseResponse(data, PortfolioSchema, fallback);
    expect(result).toEqual(fallback);
  });

  it("parses vacancy without skills (index endpoint omits them)", () => {
    const data = {
      id: 1,
      role_title: "Frontend Dev",
      culture_dimensions: "collaborative",
      competency_expectations: "React, TypeScript",
    };
    const result = parseResponse(data, VacancySchema, null as any);
    expect(result.role_title).toBe("Frontend Dev");
  });
});
