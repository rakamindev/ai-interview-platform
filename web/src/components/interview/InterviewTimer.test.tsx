import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import InterviewTimer from "./InterviewTimer";

// The timer re-arms a setTimeout after each render, so tick one second per act().
function tick(seconds: number) {
  for (let i = 0; i < seconds; i++) act(() => { vi.advanceTimersByTime(1000); });
}

describe("InterviewTimer", () => {
  it("formats the initial time as mm:ss", () => {
    render(<InterviewTimer totalSeconds={125} running={false} />);
    expect(screen.getByText(/02:05/)).toBeInTheDocument();
  });

  it("counts down only while running", () => {
    vi.useFakeTimers();
    const { rerender } = render(<InterviewTimer totalSeconds={600} running={false} />);
    tick(3);
    expect(screen.getByText(/10:00/)).toBeInTheDocument();

    rerender(<InterviewTimer totalSeconds={600} running />);
    tick(3);
    expect(screen.getByText(/09:57/)).toBeInTheDocument();
  });

  it("switches colour at 5 min (warning) and 1 min (urgent)", () => {
    const { rerender } = render(<InterviewTimer totalSeconds={301} running={false} />);
    expect(screen.getByText(/05:01/)).toHaveClass("text-foreground");
    rerender(<InterviewTimer totalSeconds={300} running={false} />);
    expect(screen.getByText(/05:00/)).toHaveClass("text-amber-500");
    rerender(<InterviewTimer totalSeconds={60} running={false} />);
    expect(screen.getByText(/01:00/)).toHaveClass("text-destructive");
  });

  it("calls onExpired when it reaches zero", () => {
    vi.useFakeTimers();
    const onExpired = vi.fn();
    render(<InterviewTimer totalSeconds={2} running onExpired={onExpired} />);
    tick(2);
    expect(onExpired).toHaveBeenCalled();
    expect(screen.getByText(/00:00/)).toBeInTheDocument();
  });

  it("resets when totalSeconds changes", () => {
    const { rerender } = render(<InterviewTimer totalSeconds={100} running={false} />);
    rerender(<InterviewTimer totalSeconds={200} running={false} />);
    expect(screen.getByText(/03:20/)).toBeInTheDocument();
  });
});
