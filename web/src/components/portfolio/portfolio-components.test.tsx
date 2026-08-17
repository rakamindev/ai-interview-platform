import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BlindModeToggle from "./BlindModeToggle";
import AssessmentStatusBadge from "./AssessmentStatusBadge";
import EvaluationSummaryPanel from "./EvaluationSummaryPanel";
import TrustContextPanel from "./TrustContextPanel";
import type { EvaluationSkillSummary, EvaluationSummary, IntegrityMetadata } from "@/types";

describe("BlindModeToggle", () => {
  it("toggles and reflects the current state", () => {
    const onToggle = vi.fn();
    const { rerender } = render(<BlindModeToggle blind={false} onToggle={onToggle} />);
    expect(screen.getByRole("button")).toHaveTextContent("Blind mode");

    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledWith(true);

    rerender(<BlindModeToggle blind={true} onToggle={onToggle} />);
    expect(screen.getByRole("button")).toHaveTextContent("Blind mode ON");
  });
});

describe("AssessmentStatusBadge", () => {
  it("shows the derived status label", () => {
    const skill: EvaluationSkillSummary = {
      id: 1,
      skill_label: "React",
      is_discovered: false,
      assessment_status: "not_assessed",
      evidence: [],
      counter_evidence: [],
    };
    render(<AssessmentStatusBadge skill={skill} />);
    expect(screen.getByText("Not assessed")).toBeInTheDocument();
  });
});

describe("EvaluationSummaryPanel", () => {
  const ready: EvaluationSummary = {
    overall_status: "ready_for_review",
    coverage: { assessed: 3, total: 3, percent: 100 },
    needs_review: false,
    review_reasons: [],
    skills: [],
  };

  const needsReview: EvaluationSummary = {
    overall_status: "needs_review",
    coverage: { assessed: 1, total: 3, percent: 33 },
    needs_review: true,
    review_reasons: ['"System Design" could not be assessed from the available responses'],
    skills: [],
  };

  it("renders ready-for-review state", () => {
    render(<EvaluationSummaryPanel summary={ready} />);
    expect(screen.getByText("Ready for review")).toBeInTheDocument();
    expect(screen.getByText("3 of 3 competencies sufficiently assessed")).toBeInTheDocument();
  });

  it("renders needs-review state with reasons", () => {
    render(<EvaluationSummaryPanel summary={needsReview} />);
    expect(screen.getByText("Needs human review")).toBeInTheDocument();
    expect(screen.getByText(/System Design.*could not be assessed/i)).toBeInTheDocument();
  });

  it("renders nothing when summary is absent", () => {
    const { container } = render(<EvaluationSummaryPanel summary={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("TrustContextPanel", () => {
  it("shows a fallback when no integrity signals were recorded", () => {
    render(<TrustContextPanel />);
    expect(screen.getByText("No integrity signals recorded")).toBeInTheDocument();
  });

  it("renders integrity signals when present", () => {
    const integrity: IntegrityMetadata = {
      device_state: "mic ok, camera passed",
      connection_health: "stable",
      reconnect_events: 0,
    };

    render(<TrustContextPanel integrity={integrity} durationSeconds={125} endReason="all_covered" />);

    expect(screen.getByText("2m 5s")).toBeInTheDocument();
    expect(screen.getByText("all covered")).toBeInTheDocument();
    expect(screen.getByText("mic ok, camera passed")).toBeInTheDocument();
    expect(screen.getByText("None — stable throughout")).toBeInTheDocument();
  });

  it("reports reconnect counts honestly", () => {
    render(<TrustContextPanel integrity={{ reconnect_events: 3 }} />);
    expect(screen.getByText("3 event(s)")).toBeInTheDocument();
  });
});
