import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import InterviewComplete from "./InterviewComplete";

describe("InterviewComplete", () => {
  it("thanks the candidate for the role they interviewed for", () => {
    render(<InterviewComplete roleTitle="Senior Frontend Engineer" />);

    expect(screen.getByRole("region", { name: "Interview Complete" })).toHaveTextContent("Senior Frontend Engineer");
    expect(screen.getByText(/Your answers have been saved/)).toBeInTheDocument();
  });

  it("falls back to a generic label when the role isn't known", () => {
    render(<InterviewComplete />);

    expect(screen.getByRole("region", { name: "Interview Complete" })).toHaveTextContent("AI Interview");
  });

  it("lists what happens next in order, saying a person reviews the AI's summary", () => {
    render(<InterviewComplete roleTitle="Senior Frontend Engineer" />);

    const steps = within(screen.getByRole("region", { name: "What happens next" })).getAllByRole("listitem");
    expect(steps.map((step) => step.querySelector("p")?.textContent)).toEqual([
      "A skill summary is drafted",
      "A person reviews it",
      "The hiring team follows up",
    ]);
  });

  it("wraps a very long role title instead of widening the page", () => {
    const longTitle = "Principal Staff Senior Frontend Platform Engineer for Design Systems and Accessibility".repeat(3);
    render(<InterviewComplete roleTitle={longTitle} />);

    expect(screen.getByText(longTitle)).toHaveClass("break-words");
  });
});
