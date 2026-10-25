import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import InterviewTimer from "@/components/interview/InterviewTimer";

afterEach(() => {
  vi.useRealTimers();
});

describe("InterviewTimer — authoritative deadline", () => {
  it("derives remaining time from the absolute server deadline", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-25T00:00:00Z"));

    render(
      <InterviewTimer
        deadlineAt="2026-10-25T00:01:30Z"
        initialRemainingSeconds={90}
        running={true}
      />
    );

    expect(screen.getByText(/01:30/)).toBeInTheDocument();

    act(() => {
      vi.setSystemTime(new Date("2026-10-25T00:01:00Z"));
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText(/00:29/)).toBeInTheDocument();
  });

  it("fires expiration at most once", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-25T00:00:00Z"));
    const onExpired = vi.fn();

    render(
      <InterviewTimer
        deadlineAt="2026-10-25T00:00:01Z"
        initialRemainingSeconds={1}
        running={true}
        onExpired={onExpired}
      />
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onExpired).toHaveBeenCalledOnce();
  });
});
