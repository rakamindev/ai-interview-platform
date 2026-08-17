import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { render, screen, act } from "@testing-library/react";
import InterviewTimer from "./InterviewTimer";

describe("InterviewTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the initial total as mm:ss", () => {
    render(<InterviewTimer totalSeconds={125} running={false} />);
    expect(screen.getByText(/02:05/)).toBeInTheDocument();
  });

  it("counts down every second while running", () => {
    render(<InterviewTimer totalSeconds={3} running={true} />);
    expect(screen.getByText(/00:03/)).toBeInTheDocument();
    void act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(/00:02/)).toBeInTheDocument();
    void act(() => vi.advanceTimersByTime(1000));
    void act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(/00:00/)).toBeInTheDocument();
  });

  it("stays frozen while not running", () => {
    render(<InterviewTimer totalSeconds={90} running={false} />);
    void act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText(/01:30/)).toBeInTheDocument();
  });

  it("fires onExpired once the count reaches zero", () => {
    const onExpired = vi.fn();
    render(<InterviewTimer totalSeconds={1} running={true} onExpired={onExpired} />);
    void act(() => vi.advanceTimersByTime(1000));
    expect(onExpired).toHaveBeenCalledTimes(1);
    void act(() => vi.advanceTimersByTime(5000));
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("resets when totalSeconds changes", () => {
    const { rerender } = render(<InterviewTimer totalSeconds={10} running={true} />);
    void act(() => vi.advanceTimersByTime(1000));
    void act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(/00:08/)).toBeInTheDocument();
    rerender(<InterviewTimer totalSeconds={30} running={true} />);
    expect(screen.getByText(/00:30/)).toBeInTheDocument();
  });

  it("applies warning styling at or below five minutes", () => {
    const { rerender } = render(<InterviewTimer totalSeconds={3600} running={false} />);
    expect(screen.getByText(/60:00/).className).toContain("text-foreground");
    rerender(<InterviewTimer totalSeconds={300} running={false} />);
    expect(screen.getByText(/05:00/).className).toContain("text-amber-500");
  });

  it("applies urgent styling at or below one minute", () => {
    render(<InterviewTimer totalSeconds={60} running={false} />);
    expect(screen.getByText(/01:00/).className).toContain("text-destructive");
  });
});
