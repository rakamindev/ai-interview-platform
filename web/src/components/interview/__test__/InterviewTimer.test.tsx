import { render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import InterviewTimer from "../InterviewTimer";

describe("InterviewTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("formats time mm:ss", () => {
    render(<InterviewTimer totalSeconds={125} running={false} />);
    expect(screen.getByText(/⏱ 02:05/)).toBeInTheDocument();
  });

  test("shows warning color when at or under 5 minutes", () => {
    render(<InterviewTimer totalSeconds={300} running={false} />);
    expect(screen.getByText(/⏱ 05:00/)).toHaveClass("text-amber-500");
  });

  test("shows urgent color when at or under 60 seconds", () => {
    render(<InterviewTimer totalSeconds={60} running={false} />);
    expect(screen.getByText(/⏱ 01:00/)).toHaveClass("text-destructive");
  });

  test("calls onExpired when timer reaches zero while running", () => {
    const onExpired = vi.fn();
    render(<InterviewTimer totalSeconds={2} running={true} onExpired={onExpired} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onExpired).toHaveBeenCalledTimes(1);
  });
});
