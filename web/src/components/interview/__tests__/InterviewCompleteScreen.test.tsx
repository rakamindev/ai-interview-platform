import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import InterviewCompleteScreen from "@/components/interview/InterviewCompleteScreen";

describe("InterviewCompleteScreen", () => {
  it("congratulates a candidate whose session actually completed", () => {
    render(<InterviewCompleteScreen endReason="all_covered" />);

    expect(screen.getByTestId("interview-complete-screen")).toHaveAttribute("data-outcome", "completed");
    expect(screen.getByText(/interview complete/i)).toBeInTheDocument();
    expect(screen.queryByText(/what to do next/i)).not.toBeInTheDocument();
  });

  it("tells a candidate the truth when the session ended in error", () => {
    render(<InterviewCompleteScreen endReason="error" />);

    expect(screen.getByTestId("interview-complete-screen")).toHaveAttribute("data-outcome", "error");
    expect(screen.getByText(/didn't finish/i)).toBeInTheDocument();
    expect(screen.getByText(/results have not been submitted/i)).toBeInTheDocument();
    // The success copy must not survive anywhere on an error screen.
    expect(screen.queryByText(/hiring team will review your results and follow up/i)).not.toBeInTheDocument();
  });

  it("surfaces the backend's own message when one is provided", () => {
    render(
      <InterviewCompleteScreen
        endReason="error"
        message="The session encountered a problem. Please contact the interviewer."
      />
    );

    expect(screen.getByText(/please contact the interviewer/i)).toBeInTheDocument();
  });

  it("shows a distinct screen when the time limit was reached", () => {
    render(<InterviewCompleteScreen endReason="time_ceiling" />);

    expect(screen.getByTestId("interview-complete-screen")).toHaveAttribute("data-outcome", "timed_out");
    expect(screen.getByText(/time is up/i)).toBeInTheDocument();
  });

  it("defaults to the error screen when no reason reached the frontend", () => {
    render(<InterviewCompleteScreen />);

    expect(screen.getByTestId("interview-complete-screen")).toHaveAttribute("data-outcome", "error");
  });
});
