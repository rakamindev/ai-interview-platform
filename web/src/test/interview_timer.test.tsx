import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import InterviewTimer from "@/components/interview/InterviewTimer";

describe("InterviewTimer Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the formatted time correctly", () => {
    render(<InterviewTimer totalSeconds={600} running={false} />);
    expect(screen.getByText("⏱ 10:00")).toBeInTheDocument();
  });

  it("applies normal styling when time is greater than 5 minutes", () => {
    render(<InterviewTimer totalSeconds={360} running={false} />);
    const timer = screen.getByText("⏱ 06:00");
    expect(timer.className).toContain("text-foreground");
  });

  it("applies warning styling when time is 5 minutes or less", () => {
    render(<InterviewTimer totalSeconds={300} running={false} />);
    const timer = screen.getByText("⏱ 05:00");
    expect(timer.className).toContain("text-amber-500");
  });

  it("applies urgent styling when time is 1 minute or less", () => {
    render(<InterviewTimer totalSeconds={60} running={false} />);
    const timer = screen.getByText("⏱ 01:00");
    expect(timer.className).toContain("text-destructive");
  });

  it("counts down when running is true", () => {
    render(<InterviewTimer totalSeconds={120} running={true} />);
    expect(screen.getByText("⏱ 02:00")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("⏱ 01:59")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("⏱ 01:58")).toBeInTheDocument();
  });

  it("calls onExpired when timer reaches 0", () => {
    const handleExpired = vi.fn();
    render(<InterviewTimer totalSeconds={1} running={true} onExpired={handleExpired} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(handleExpired).toHaveBeenCalledTimes(1);
  });
});
