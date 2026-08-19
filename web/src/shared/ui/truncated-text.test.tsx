import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import TruncatedText from "./truncated-text";

describe("TruncatedText", () => {
  it("renders short text as-is, with no expand control", () => {
    render(<TruncatedText text="A short sentence." maxLength={50} />);
    expect(screen.getByText("A short sentence.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("truncates long text and offers a Show more control", async () => {
    const long = "x".repeat(300);
    render(<TruncatedText text={long} maxLength={50} />);

    expect(screen.getByText(/^x{50}…$/)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /show more/i }));

    expect(screen.getByText(long)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show less/i })).toBeInTheDocument();
  });
});
