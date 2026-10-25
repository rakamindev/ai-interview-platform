import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import InterviewTimer from "./InterviewTimer";

describe("InterviewTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders formatted initial remaining seconds accurately", () => {
    render(
      <InterviewTimer
        totalSeconds={600}
        remainingSeconds={180}
        running={false}
      />
    );

    expect(screen.getByText("⏱ 03:00")).toBeInTheDocument();
  });

  it("decrements remaining time when running is true", () => {
    render(
      <InterviewTimer
        totalSeconds={600}
        remainingSeconds={120}
        running={true}
      />
    );

    expect(screen.getByText("⏱ 02:00")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText("⏱ 01:58")).toBeInTheDocument();
  });

  it("calls onExpired when remaining seconds reaches zero", () => {
    const onExpiredMock = vi.fn();

    render(
      <InterviewTimer
        totalSeconds={600}
        remainingSeconds={2}
        running={true}
        onExpired={onExpiredMock}
      />
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onExpiredMock).toHaveBeenCalled();
  });
});
