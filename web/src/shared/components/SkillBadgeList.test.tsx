import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SkillBadgeList from "./SkillBadgeList";

describe("SkillBadgeList", () => {
  it("renders all labels when at or under the cap", () => {
    render(<SkillBadgeList labels={["Ruby", "SQL"]} max={3} />);
    expect(screen.getByText("Ruby")).toBeInTheDocument();
    expect(screen.getByText("SQL")).toBeInTheDocument();
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it("caps the visible badges and shows an overflow count", () => {
    render(<SkillBadgeList labels={["A", "B", "C", "D", "E"]} max={3} />);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
    expect(screen.queryByText("D")).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("renders nothing for an empty list", () => {
    const { container } = render(<SkillBadgeList labels={[]} max={3} />);
    expect(container).toBeEmptyDOMElement();
  });
});
