import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MatchSummaryCard from "./MatchSummaryCard";

describe("MatchSummaryCard", () => {
  it("renders match percentage and skill breakdown correctly", () => {
    render(
      <MatchSummaryCard
        matchPercentage={75}
        matchCount={3}
        exceedCount={1}
        gapCount={1}
        totalSkills={5}
      />
    );

    expect(screen.getByText("75%")).toBeDefined();
    expect(screen.getByText("Role Match Summary")).toBeDefined();
    expect(screen.getByText("3 matched")).toBeDefined();
    expect(screen.getByText("1 exceed")).toBeDefined();
    expect(screen.getByText("1 gaps")).toBeDefined();
    expect(screen.getByText("5 total skills")).toBeDefined();
  });
});
