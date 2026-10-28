import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ConfidenceIndicator from "./ConfidenceIndicator";

// Harness smoke test: proves jsdom, React Testing Library and jest-dom matchers are wired up.
describe("ConfidenceIndicator", () => {
  it("renders the confidence label from the API value", () => {
    render(<ConfidenceIndicator confidence="medium" />);
    expect(screen.getByText("Confidence: MEDIUM")).toBeInTheDocument();
  });
});
