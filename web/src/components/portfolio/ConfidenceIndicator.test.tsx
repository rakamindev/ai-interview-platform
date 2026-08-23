import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ConfidenceIndicator from "./ConfidenceIndicator";

describe("ConfidenceIndicator", () => {
  it("renders high confidence", () => {
    render(<ConfidenceIndicator confidence="high" />);
    expect(screen.getByText("High confidence")).toBeInTheDocument();
  });

  it("renders medium confidence", () => {
    render(<ConfidenceIndicator confidence="medium" />);
    expect(screen.getByText("Medium confidence")).toBeInTheDocument();
  });

  it("renders low confidence when explicitly set", () => {
    render(<ConfidenceIndicator confidence="low" />);
    expect(screen.getByText("Low confidence")).toBeInTheDocument();
  });

  it("renders nothing when confidence is undefined", () => {
    const { container } = render(<ConfidenceIndicator confidence={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when confidence is empty string", () => {
    const { container } = render(<ConfidenceIndicator confidence="" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for unknown confidence values", () => {
    const { container } = render(<ConfidenceIndicator confidence="unknown" />);
    expect(container.firstChild).toBeNull();
  });

  it("is case-insensitive", () => {
    render(<ConfidenceIndicator confidence="HIGH" />);
    expect(screen.getByText("High confidence")).toBeInTheDocument();
  });
});
