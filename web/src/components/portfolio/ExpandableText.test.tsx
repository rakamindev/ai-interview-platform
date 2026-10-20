import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExpandableText from "./ExpandableText";

// AC-28: long quotes and summaries are collapsed, never cut off or pushed out of the layout.
describe("ExpandableText", () => {
  const long = "We profiled every render path and measured again after each change. ".repeat(12);

  it("shows short text as it is, with no toggle", () => {
    render(<ExpandableText text="Handles complex state." />);

    expect(screen.getByText("Handles complex state.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("collapses long text behind a Show more button that says whether it's expanded", async () => {
    const user = userEvent.setup();
    render(<ExpandableText text={long} />);

    const toggle = screen.getByRole("button", { name: "Show more" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(long.trim())).toHaveClass("line-clamp-4");

    await user.click(toggle);

    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(long.trim())).not.toHaveClass("line-clamp-4");
  });

  it("breaks a very long unbroken string instead of overflowing", () => {
    render(<ExpandableText text={"a".repeat(600)} />);

    expect(screen.getByText("a".repeat(600))).toHaveClass("break-words");
  });
});
