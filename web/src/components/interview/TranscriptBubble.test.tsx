import { describe, it, expect } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import TranscriptBubble from "./TranscriptBubble";

describe("TranscriptBubble", () => {
  it("labels candidate messages as You and aligns them right", () => {
    render(<TranscriptBubble speaker="candidate" text="Hello there" />);
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Hello there")).toBeInTheDocument();
    const bubble = screen.getByText("Hello there");
    expect(bubble.className).toContain("bg-primary/10");
    expect(bubble.parentElement?.className).toContain("justify-end");
  });

  it("labels other speakers as AI and aligns them left", () => {
    render(<TranscriptBubble speaker="ai" text="Welcome" />);
    expect(screen.getByText("AI")).toBeInTheDocument();
    const bubble = screen.getByText("Welcome");
    expect(bubble.className).toContain("bg-muted");
    expect(bubble.parentElement?.className).toContain("justify-start");
  });

  it("renders the text for every speaker variant", () => {
    const { rerender } = render(<TranscriptBubble speaker="assessor" text="t1" />);
    expect(screen.getByText("t1")).toBeInTheDocument();
    rerender(<TranscriptBubble speaker="system" text="t2" />);
    expect(screen.getByText("t2")).toBeInTheDocument();
  });
});
