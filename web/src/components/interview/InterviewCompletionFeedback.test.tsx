import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import InterviewCompletionFeedback, { completionCopy } from "./InterviewCompletionFeedback";

describe("InterviewCompletionFeedback", () => {
  it("explains the review process after a completed interview without inventing an outcome", () => {
    render(<InterviewCompletionFeedback roleTitle="Senior Frontend Engineer" endReason="all_covered" />);

    expect(screen.getByRole("heading", { name: "Interview complete" })).toBeInTheDocument();
    expect(screen.getByText("Senior Frontend Engineer")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What happens next" })).toBeInTheDocument();
    expect(screen.getByText("We are preparing your interview record for the hiring team.")).toBeInTheDocument();
    expect(screen.getByText(/will review the assessment and communicate any next steps/)).toBeInTheDocument();
    expect(screen.queryByText(/you passed|you failed/i)).not.toBeInTheDocument();
  });

  it("does not imply a clean completion when the server reports a technical error", () => {
    const copy = completionCopy("error");
    render(<InterviewCompletionFeedback endReason="error" />);

    expect(copy.technicalIssue).toBe(true);
    expect(screen.getByRole("heading", { name: "Interview ended due to a technical problem" })).toBeInTheDocument();
    expect(screen.getByText(/Keep your invitation details available/)).toBeInTheDocument();
  });
});
