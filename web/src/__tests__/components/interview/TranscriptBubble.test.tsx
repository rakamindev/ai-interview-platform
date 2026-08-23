import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import TranscriptBubble from "@/components/interview/TranscriptBubble";

describe("TranscriptBubble", () => {
  it("renders humanized label AI Interviewer for speaker ai", () => {
    render(<TranscriptBubble speaker="ai" text="Welcome to the interview." />);
    expect(screen.getByText("AI Interviewer")).toBeInTheDocument();
  });

  it("renders humanized label Candidate for speaker candidate", () => {
    render(<TranscriptBubble speaker="candidate" text="Thank you." />);
    expect(screen.getByText("Candidate")).toBeInTheDocument();
  });
});
