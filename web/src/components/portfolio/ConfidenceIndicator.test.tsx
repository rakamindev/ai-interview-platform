import { describe, it, expect } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import ConfidenceIndicator from "./ConfidenceIndicator";

describe("ConfidenceIndicator", () => {
  it("shows HIGH for high confidence", () => {
    render(<ConfidenceIndicator confidence="high" />);
    expect(screen.getByText("Confidence: HIGH")).toBeInTheDocument();
    expect(screen.getByText("Confidence: HIGH").className).toContain("text-green-600");
  });

  it("shows MEDIUM for medium confidence", () => {
    render(<ConfidenceIndicator confidence="medium" />);
    expect(screen.getByText("Confidence: MEDIUM")).toBeInTheDocument();
  });

  it("shows LOW for low confidence", () => {
    render(<ConfidenceIndicator confidence="low" />);
    expect(screen.getByText("Confidence: LOW")).toBeInTheDocument();
    expect(screen.getByText("Confidence: LOW").className).toContain("text-destructive");
  });

  it("treats unknown values as low confidence", () => {
    render(<ConfidenceIndicator confidence="sometimes" />);
    expect(screen.getByText("Confidence: LOW")).toBeInTheDocument();
  });
});
