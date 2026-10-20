import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InterviewTimer from "@/components/interview/InterviewTimer";

describe("InterviewTimer", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("shows the whole remaining time in mm:ss", () => {
        render(<InterviewTimer totalSeconds={90} running onExpired={vi.fn()} />);

        expect(screen.getByText("⏱ 01:30")).toBeInTheDocument();
    });

    it("counts down exactly once per elapsed second", () => {
        render(<InterviewTimer totalSeconds={90} running onExpired={vi.fn()} />);

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(screen.getByText("⏱ 01:29")).toBeInTheDocument();
        expect(screen.queryByText("⏱ 01:30")).not.toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(screen.getByText("⏱ 01:28")).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(screen.getByText("⏱ 01:27")).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(500);
        });
        expect(screen.getByText("⏱ 01:27")).toBeInTheDocument();
    });

    it("does not count down while it is not running", () => {
        render(<InterviewTimer totalSeconds={90} running={false} onExpired={vi.fn()} />);

        act(() => {
            vi.advanceTimersByTime(5000);
        });

        expect(screen.getByText("⏱ 01:30")).toBeInTheDocument();
    });

    it("restarts the display from the new total when totalSeconds changes", () => {
        const { rerender } = render(<InterviewTimer totalSeconds={90} running onExpired={vi.fn()} />);

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(screen.getByText("⏱ 01:27")).toBeInTheDocument();

        rerender(<InterviewTimer totalSeconds={300} running onExpired={vi.fn()} />);
        expect(screen.getByText("⏱ 05:00")).toBeInTheDocument();

        rerender(<InterviewTimer totalSeconds={45} running onExpired={vi.fn()} />);
        expect(screen.getByText("⏱ 00:45")).toBeInTheDocument();
        expect(screen.queryByText("⏱ 05:00")).not.toBeInTheDocument();
    });

    it("reports expiry exactly once when the countdown reaches zero", () => {
        const onExpired = vi.fn();
        render(<InterviewTimer totalSeconds={2} running onExpired={onExpired} />);

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(screen.getByText("⏱ 00:01")).toBeInTheDocument();
        expect(onExpired).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(screen.getByText("⏱ 00:00")).toBeInTheDocument();
        expect(onExpired).toHaveBeenCalledTimes(1);

        act(() => {
            vi.advanceTimersByTime(10000);
        });
        expect(onExpired).toHaveBeenCalledTimes(1);
    });

    it("never reports expiry while it is not running", () => {
        const onExpired = vi.fn();
        render(<InterviewTimer totalSeconds={1} running={false} onExpired={onExpired} />);

        act(() => {
            vi.advanceTimersByTime(10000);
        });

        expect(onExpired).not.toHaveBeenCalled();
        expect(screen.getByText("⏱ 00:01")).toBeInTheDocument();
    });

    it("formats the warning and urgent thresholds as readable times", () => {
        const { rerender } = render(<InterviewTimer totalSeconds={301} running={false} />);
        expect(screen.getByText("⏱ 05:01")).toBeInTheDocument();

        rerender(<InterviewTimer totalSeconds={299} running={false} />);
        expect(screen.getByText("⏱ 04:59")).toBeInTheDocument();

        rerender(<InterviewTimer totalSeconds={60} running={false} />);
        expect(screen.getByText("⏱ 01:00")).toBeInTheDocument();

        rerender(<InterviewTimer totalSeconds={0} running={false} />);
        expect(screen.getByText("⏱ 00:00")).toBeInTheDocument();
    });
});
