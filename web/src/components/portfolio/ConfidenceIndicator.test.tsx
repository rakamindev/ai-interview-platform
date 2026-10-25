import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ConfidenceIndicator from "./ConfidenceIndicator";

describe("ConfidenceIndicator", () => {
  it("renders HIGH confidence indicator with green styling", () => {
    render(<ConfidenceIndicator confidence="high" />);
    expect(screen.getByText("Confidence: HIGH")).toBeInTheDocument();
  });

  it("renders MEDIUM confidence indicator with amber styling", () => {
    render(<ConfidenceIndicator confidence="medium" />);
    expect(screen.getByText("Confidence: MEDIUM")).toBeInTheDocument();
  });

  it("renders LOW confidence indicator when low or unrecognized", () => {
    render(<ConfidenceIndicator confidence="low" />);
    expect(screen.getByText("Confidence: LOW")).toBeInTheDocument();
  });
});
