import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InterviewTimer from "./InterviewTimer";

// F20: after a rejoin the timer restarted at the full limit while the server kept its own clock,
// so the interview ended with "08:00" still on screen.
describe("InterviewTimer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts from the time the server says is left, not the full limit", () => {
    render(<InterviewTimer totalSeconds={600} remainingSeconds={120} running />);

    expect(screen.getByText(/02:00/)).toBeInTheDocument();
  });

  it("keeps counting down from the remaining time", () => {
    render(<InterviewTimer totalSeconds={600} remainingSeconds={120} running />);

    // One tick per act: each second schedules the next only after React re-renders.
    for (let i = 0; i < 3; i++) act(() => { vi.advanceTimersByTime(1000); });

    expect(screen.getByText(/01:57/)).toBeInTheDocument();
  });

  it("falls back to the full limit when the server gives no remaining time", () => {
    render(<InterviewTimer totalSeconds={600} running={false} />);

    expect(screen.getByText(/10:00/)).toBeInTheDocument();
  });
});
