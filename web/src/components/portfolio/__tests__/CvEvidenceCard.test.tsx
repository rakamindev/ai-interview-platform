import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CvEvidenceCard from "../CvEvidenceCard";

describe("CvEvidenceCard", () => {
  it("renders null when both cv claims and interview quotes are empty", () => {
    const { container } = render(
      <CvEvidenceCard matchingCvClaims={[]} interviewEvidence={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders side-by-side CV claims and interview quotes with metadata tags", () => {
    const mockClaims = [
      {
        section_type: "projects",
        company: "Gojek",
        content: "Scaled distributed payment ledger on PostgreSQL and Kafka.",
      },
    ];

    const mockEvidence = [
      "We handled partition rebalancing using custom key hashing.",
    ];

    render(
      <CvEvidenceCard
        matchingCvClaims={mockClaims}
        interviewEvidence={mockEvidence}
      />
    );

    expect(screen.getByText("CV Claims vs Interview Verification")).toBeInTheDocument();
    expect(screen.getByText("Candidate CV Claims")).toBeInTheDocument();
    expect(screen.getByText("@Gojek")).toBeInTheDocument();
    expect(screen.getByText(/Scaled distributed payment ledger/i)).toBeInTheDocument();

    expect(screen.getByText("Spoken Interview Quotes")).toBeInTheDocument();
    expect(screen.getByText(/"We handled partition rebalancing using custom key hashing\."/i)).toBeInTheDocument();
  });

  it("displays fallback notice when no CV claim is linked to the assessed skill", () => {
    render(
      <CvEvidenceCard
        matchingCvClaims={[]}
        interviewEvidence={["Candidate explained index selectivity and query planner cost models."]}
      />
    );

    expect(screen.getByText("No matching project claim found in parsed CV.")).toBeInTheDocument();
    expect(screen.getByText(/"Candidate explained index selectivity and query planner cost models\."/i)).toBeInTheDocument();
  });
});
