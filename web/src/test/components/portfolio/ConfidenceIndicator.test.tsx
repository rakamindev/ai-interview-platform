import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ConfidenceIndicator from "@/components/portfolio/ConfidenceIndicator";

describe("ConfidenceIndicator", () => {
  it("renders HIGH for high confidence", () => {
    render(<ConfidenceIndicator confidence="high" />);
    expect(screen.getByText("Confidence: HIGH")).toBeInTheDocument();
  });

  it("renders MEDIUM for medium confidence", () => {
    render(<ConfidenceIndicator confidence="medium" />);
    expect(screen.getByText("Confidence: MEDIUM")).toBeInTheDocument();
  });

  it("renders LOW for low confidence", () => {
    render(<ConfidenceIndicator confidence="low" />);
    expect(screen.getByText("Confidence: LOW")).toBeInTheDocument();
  });

  it("normalizes case, so 'High' renders the same as 'high'", () => {
    render(<ConfidenceIndicator confidence="High" />);
    expect(screen.getByText("Confidence: HIGH")).toBeInTheDocument();
  });

  it("falls back to LOW for an unrecognized confidence value", () => {
    render(<ConfidenceIndicator confidence="unknown" />);
    expect(screen.getByText("Confidence: LOW")).toBeInTheDocument();
  });
});
