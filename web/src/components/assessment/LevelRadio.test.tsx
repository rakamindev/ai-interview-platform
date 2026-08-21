import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import LevelRadio from "./LevelRadio";

vi.mock("@/utils/constants", () => ({
  LEVEL_LABELS: { 1: "Novice", 2: "Beginner", 3: "Intermediate", 4: "Advanced", 5: "Expert" },
}));

describe("LevelRadio", () => {
  it("renders no duplicate DOM ids when two instances share the page", () => {
    const { container } = render(
      <div>
        <LevelRadio value={3} onChange={vi.fn()} idPrefix="skill-a" />
        <LevelRadio value={2} onChange={vi.fn()} idPrefix="skill-b" />
      </div>
    );

    const allIds = Array.from(container.querySelectorAll("[id]")).map((el) => el.id);
    const uniqueIds = new Set(allIds);

    expect(allIds.length).toBe(uniqueIds.size);
  });

  it("uses idPrefix to scope ids", () => {
    const { container } = render(
      <LevelRadio value={1} onChange={vi.fn()} idPrefix="my-skill" />
    );

    expect(container.querySelector("#level-my-skill-1")).toBeTruthy();
    expect(container.querySelector("#level-my-skill-3")).toBeTruthy();
  });

  it("falls back to 'default' prefix when no idPrefix given", () => {
    const { container } = render(<LevelRadio value={1} onChange={vi.fn()} />);

    expect(container.querySelector("#level-default-1")).toBeTruthy();
  });
});
