import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LevelBadge from "@/components/portfolio/LevelBadge";
import ConfidenceIndicator from "@/components/portfolio/ConfidenceIndicator";
import TranscriptBubble from "@/components/interview/TranscriptBubble";

describe("Frontend Component Rendering", () => {
  it("renders LevelBadge correctly", () => {
    render(<LevelBadge level={3} />);
    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText("Proficient")).toBeInTheDocument();
  });

  it("renders ConfidenceIndicator correctly", () => {
    render(<ConfidenceIndicator confidence="high" />);
    expect(screen.getByText("Confidence: HIGH")).toBeInTheDocument();
  });

  it("renders TranscriptBubble correctly", () => {
    render(<TranscriptBubble speaker="candidate" text="Hello world" />);
    expect(screen.getByText("Candidate")).toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });
});
