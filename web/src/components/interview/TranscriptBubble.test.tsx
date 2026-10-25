import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import TranscriptBubble from "./TranscriptBubble";

describe("TranscriptBubble", () => {
  it("renders candidate message labeled 'You' aligned right", () => {
    const { container } = render(
      <TranscriptBubble speaker="candidate" text="I implemented a multi-tenant database connection pool." />
    );

    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("I implemented a multi-tenant database connection pool.")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("justify-end");
  });

  it("renders AI question labeled 'AI' aligned left", () => {
    const { container } = render(
      <TranscriptBubble speaker="ai" text="How did you handle tenant schema migrations without downtime?" />
    );

    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("How did you handle tenant schema migrations without downtime?")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("justify-start");
  });
});
