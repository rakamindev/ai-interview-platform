import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RubricVersionComparisonDialog from "./RubricVersionComparisonDialog";

describe("RubricVersionComparisonDialog", () => {
  it("shows settings, skill, and anchor changes between captured rubrics", () => {
    render(
      <RubricVersionComparisonDialog
        open
        onOpenChange={() => {}}
        versions={[
          {
            id: 2,
            rubric_version: 2,
            name: "Staff Frontend Engineer",
            time_limit_min: 60,
            language: "en",
            created_at: "2026-08-23T00:00:00Z",
            skills: [{ skill_id: "react", skill_label: "React", is_custom: false, expected_level: 4, display_order: 0, l1_anchor: "V2 L1", l2_anchor: "L2", l3_anchor: "V2 L3", l4_anchor: "L4", l5_anchor: "L5" }],
          },
          {
            id: 1,
            rubric_version: 1,
            name: "Senior Frontend Engineer",
            time_limit_min: 45,
            language: "en",
            created_at: "2026-08-22T00:00:00Z",
            skills: [{ skill_id: "react", skill_label: "React", is_custom: false, expected_level: 3, display_order: 0, l1_anchor: "V1 L1", l2_anchor: "L2", l3_anchor: "V1 L3", l4_anchor: "L4", l5_anchor: "L5" }],
          },
        ]}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Assessment settings")).toBeInTheDocument();
    expect(screen.getByText("Staff Frontend Engineer")).toBeInTheDocument();
    expect(screen.getByText("Time limit")).toBeInTheDocument();
    expect(screen.getByText("Skills and evaluation anchors")).toBeInTheDocument();
    expect(screen.getByText("Expected level")).toBeInTheDocument();
    expect(screen.getByText("V1 L3")).toBeInTheDocument();
    expect(screen.getByText("V2 L3")).toBeInTheDocument();
  });
});
