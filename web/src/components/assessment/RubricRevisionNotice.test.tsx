import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RubricRevisionNotice from "./RubricRevisionNotice";

describe("RubricRevisionNotice", () => {
  it("explains that template edits apply only to future invitations", () => {
    render(<RubricRevisionNotice />);

    expect(screen.getByRole("note")).toHaveTextContent(
      "Changes create a new rubric revision for future invitations."
    );
    expect(screen.getByRole("note")).toHaveTextContent(
      "Existing candidate sessions keep the rubric version captured"
    );
  });
});
