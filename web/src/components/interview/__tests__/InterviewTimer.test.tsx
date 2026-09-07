import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import InterviewTimer from "@/components/interview/InterviewTimer";

/**
 * The timer chains one setTimeout per second, so each tick needs its own render
 * pass before the next one is scheduled. Advancing 3000ms in a single act only
 * fires the first.
 */
function tick(seconds: number) {
  for (let i = 0; i < seconds; i += 1) {
    act(() => { vi.advanceTimersByTime(1000); });
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("InterviewTimer", () => {
  it("shows the full time before the interview starts counting", () => {
    render(<InterviewTimer totalSeconds={1800} running={false} />);

    expect(screen.getByText("30:00")).toBeInTheDocument();
  });

  it("counts down while the interview is running", () => {
    vi.useFakeTimers();
    render(<InterviewTimer totalSeconds={1800} running />);

    tick(3);

    expect(screen.getByText("29:57")).toBeInTheDocument();
  });

  // Colour is never the only signal — the remaining minutes are also announced.
  it("announces the remaining minutes to screen readers", () => {
    render(<InterviewTimer totalSeconds={120} running={false} />);

    expect(screen.getByText("2 minutes remaining")).toBeInTheDocument();
  });

  it("ends the interview when the clock runs out", () => {
    vi.useFakeTimers();
    const onExpired = vi.fn();
    render(<InterviewTimer totalSeconds={2} running onExpired={onExpired} />);

    tick(3);

    expect(onExpired).toHaveBeenCalled();
  });

  it("never renders a negative clock", () => {
    render(<InterviewTimer totalSeconds={0} running={false} />);

    expect(screen.getByText("00:00")).toBeInTheDocument();
  });
});
