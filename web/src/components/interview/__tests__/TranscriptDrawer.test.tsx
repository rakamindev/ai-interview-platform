import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TranscriptDrawer from "../TranscriptDrawer";

describe("TranscriptDrawer", () => {
  it("renders null when closed", () => {
    const { container } = render(
      <TranscriptDrawer open={false} onClose={vi.fn()} transcript={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders drawer with turns and calls onClose when close button clicked", () => {
    const handleClose = vi.fn();
    const mockTurns = [
      { speaker: "ai" as const, text: "Can you explain optimistic locking?" },
      { speaker: "candidate" as const, text: "It uses a version column without blocking reads." },
    ];

    render(
      <TranscriptDrawer open={true} onClose={handleClose} transcript={mockTurns} />
    );

    expect(screen.getByText("Live Transcript")).toBeInTheDocument();
    expect(screen.getByText("2 turns")).toBeInTheDocument();
    expect(screen.getByText("Can you explain optimistic locking?")).toBeInTheDocument();
    expect(screen.getByText("It uses a version column without blocking reads.")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: /close transcript drawer/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
