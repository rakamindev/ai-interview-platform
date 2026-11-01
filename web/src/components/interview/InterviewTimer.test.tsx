import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import InterviewTimer from "@/components/interview/InterviewTimer";

const NOW = new Date("2026-01-01T00:00:00Z").getTime();

function advance(seconds: number) {
  act(() => vi.advanceTimersByTime(seconds * 1000));
}

describe("InterviewTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the full time until the interview has a deadline", () => {
    render(<InterviewTimer totalSeconds={2700} deadlineMs={null} running={false} />);

    expect(screen.getByText("45:00")).toBeInTheDocument();
  });

  it("counts down to the deadline", () => {
    render(<InterviewTimer totalSeconds={2700} deadlineMs={NOW + 600_000} running />);

    expect(screen.getByText("10:00")).toBeInTheDocument();
    advance(3);
    expect(screen.getByText("09:57")).toBeInTheDocument();
  });

  it("catches up with real time after a pause instead of losing it", () => {
    const { rerender } = render(
      <InterviewTimer totalSeconds={2700} deadlineMs={NOW + 600_000} running />,
    );

    rerender(<InterviewTimer totalSeconds={2700} deadlineMs={NOW + 600_000} running={false} />);
    advance(60);
    rerender(<InterviewTimer totalSeconds={2700} deadlineMs={NOW + 600_000} running />);

    expect(screen.getByText("09:00")).toBeInTheDocument();
  });

  it("reports expiry once when the deadline passes, and never shows negative time", () => {
    const onExpired = vi.fn();
    render(
      <InterviewTimer totalSeconds={2700} deadlineMs={NOW + 2000} running onExpired={onExpired} />,
    );

    advance(5);

    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("does not report expiry while paused", () => {
    const onExpired = vi.fn();
    render(
      <InterviewTimer
        totalSeconds={2700}
        deadlineMs={NOW - 1000}
        running={false}
        onExpired={onExpired}
      />,
    );

    advance(5);

    expect(onExpired).not.toHaveBeenCalled();
  });
});
