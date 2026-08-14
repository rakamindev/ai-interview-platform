import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import InterviewTimer from "@/components/interview/InterviewTimer";

function timerEl() {
  return screen.getByText(/\d\d:\d\d/).closest("span") as HTMLElement;
}

describe("InterviewTimer", () => {
  it("shows the remaining time in tabular mono so the digits do not jitter", () => {
    render(<InterviewTimer totalSeconds={1800} running={false} />);

    expect(screen.getByText("30:00")).toBeInTheDocument();
    expect(timerEl().className).toContain("tabular-nums");
    expect(screen.getByText("Time remaining:")).toBeInTheDocument();
  });

  it("flags the last five minutes with the attention accent", () => {
    render(<InterviewTimer totalSeconds={240} running={false} />);

    expect(screen.getByText("left")).toBeInTheDocument();
    expect(timerEl().className).toContain("text-secondary-foreground");
  });

  it("never turns red, however little time is left", () => {
    // The candidate reads this clock while being judged. Red means something is
    // broken; a countdown styled like a failure just makes them perform worse.
    const { container, unmount } = render(<InterviewTimer totalSeconds={20} running={false} />);
    expect(container.innerHTML).not.toContain("destructive");
    unmount();

    const zero = render(<InterviewTimer totalSeconds={0} running={false} />);
    expect(zero.container.innerHTML).not.toContain("destructive");
  });
});
