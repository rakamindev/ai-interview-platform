import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EvidenceStrip from "./EvidenceStrip";

describe("EvidenceStrip", () => {
  it("shows one mark per skill, and says the same facts in words, with no level", () => {
    const { container } = render(
      <EvidenceStrip statuses={["assessed", "assessed", "thin_evidence", "assessed", "not_assessed"]} />
    );

    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Evidence for 5 skills: 3 assessed, 1 needs a human look, 1 not assessed"
    );
    expect(screen.getByText("3 of 5 assessed · 1 needs a look · 1 not assessed")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-evidence-state]")).toHaveLength(5);
    expect(screen.queryByText(/L[1-5]/)).not.toBeInTheDocument();
  });
});
