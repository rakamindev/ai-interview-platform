import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import InterviewTimer from "./InterviewTimer";
import ConnectionStatus from "./ConnectionStatus";

describe("InterviewTimer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const tick = (seconds: number) => {
    for (let i = 0; i < seconds; i++) act(() => vi.advanceTimersByTime(1000));
  };

  it("shows the time left as mm:ss and counts down while running", () => {
    render(<InterviewTimer totalSeconds={45 * 60} running />);
    expect(screen.getByText("⏱ 45:00")).toBeInTheDocument();

    tick(61);

    expect(screen.getByText("⏱ 43:59")).toBeInTheDocument();
  });

  it("holds still while paused", () => {
    render(<InterviewTimer totalSeconds={600} running={false} />);

    tick(5);

    expect(screen.getByText("⏱ 10:00")).toBeInTheDocument();
  });

  it("warns in the last five minutes and turns urgent in the last minute", () => {
    const { rerender } = render(<InterviewTimer totalSeconds={301} running={false} />);
    expect(screen.getByText(/05:01/)).toHaveClass("text-foreground");

    rerender(<InterviewTimer totalSeconds={300} running={false} />);
    expect(screen.getByText(/05:00/)).toHaveClass("text-amber-500");

    rerender(<InterviewTimer totalSeconds={60} running={false} />);
    expect(screen.getByText(/01:00/)).toHaveClass("text-destructive");
  });

  it("calls onExpired once time runs out", () => {
    const onExpired = vi.fn();
    render(<InterviewTimer totalSeconds={2} running onExpired={onExpired} />);

    tick(1);
    expect(onExpired).not.toHaveBeenCalled();

    tick(1);
    expect(screen.getByText("⏱ 00:00")).toBeInTheDocument();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("restarts from the new total when the time limit changes", () => {
    const { rerender } = render(<InterviewTimer totalSeconds={600} running={false} />);

    rerender(<InterviewTimer totalSeconds={1800} running={false} />);

    expect(screen.getByText("⏱ 30:00")).toBeInTheDocument();
  });
});

describe("ConnectionStatus", () => {
  it.each([
    ["connected", "Connected"],
    ["reconnecting", "Reconnecting..."],
    ["lost", "Connection lost"],
  ] as const)("says %s", (state, text) => {
    render(<ConnectionStatus state={state} />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
