import { describe, expect, it } from "vitest";
import { parseCoverageUpdate } from "../coveragePayload";

describe("parseCoverageUpdate", () => {
  const validSkill = {
    id: 1,
    skill_id: "javascript",
    skill_label: "JavaScript",
    is_discovered: false,
    state: "initiated",
    probe_count: 1,
    last_signal: "Used JavaScript at work",
  };

  it("accepts a valid coverage update", () => {
    const payload = {
      type: "coverage_update",
      skills: [validSkill],
      discovered: [],
    };

    expect(parseCoverageUpdate(payload)).toEqual({
      skills: [validSkill],
      discovered: [],
    });
  });

  it("accepts discovered skills with a null skill_id", () => {
    const discoveredSkill = {
      ...validSkill,
      skill_id: null,
      skill_label: "Ruby",
      is_discovered: true,
    };

    const result = parseCoverageUpdate({
      type: "coverage_update",
      skills: [],
      discovered: [discoveredSkill],
    });

    expect(result?.discovered).toEqual([discoveredSkill]);
  });

  it("rejects a payload with a non-array skills field", () => {
    expect(
      parseCoverageUpdate({
        type: "coverage_update",
        skills: {},
        discovered: [],
      }),
    ).toBeNull();
  });

  it("rejects a skill with an empty label", () => {
    expect(
      parseCoverageUpdate({
        type: "coverage_update",
        skills: [{ ...validSkill, skill_label: "  " }],
        discovered: [],
      }),
    ).toBeNull();
  });

  it("rejects a skill with an invalid state", () => {
    expect(
      parseCoverageUpdate({
        type: "coverage_update",
        skills: [{ ...validSkill, state: "unknown" }],
        discovered: [],
      }),
    ).toBeNull();
  });

  it("rejects messages of another type", () => {
    expect(
      parseCoverageUpdate({
        type: "session_status",
        status: "ended",
      }),
    ).toBeNull();
  });
});
