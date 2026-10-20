import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { API, server } from "@/test/server";
import { skillTaxonomies } from "@/test/fixtures";
import LevelRadio from "./LevelRadio";
import SkillPicker from "./SkillPicker";

function ControlledLevel({ initial }: { initial: number | null }) {
  const [level, setLevel] = useState(initial);
  return <LevelRadio value={level} onChange={setLevel} />;
}

const checkedIn = (group: HTMLElement) =>
  within(group).getAllByRole("radio").findIndex((r) => r.getAttribute("aria-checked") === "true") + 1;

describe("LevelRadio", () => {
  it("offers L1 to L5 and reports the picked level as a number", async () => {
    const onChange = vi.fn();
    render(<LevelRadio value={3} onChange={onChange} />);

    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(checkedIn(screen.getByRole("radiogroup"))).toBe(3);

    await userEvent.click(screen.getAllByRole("radio")[3]);

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("shows nothing selected for a skill without a level yet", () => {
    render(<LevelRadio value={null} onChange={() => {}} />);

    expect(checkedIn(screen.getByRole("radiogroup"))).toBe(0);
  });

  it("can't be changed when disabled", async () => {
    const onChange = vi.fn();
    render(<LevelRadio value={2} onChange={onChange} disabled />);

    await userEvent.click(screen.getAllByRole("radio")[4]);

    expect(onChange).not.toHaveBeenCalled();
  });

  describe("known defects", () => {
    // Every LevelRadio renders ids level-1..level-5, so with two on a page (two skills on the assessment or vacancy
    // form) each label points at the first group's radio.
    it.fails("P2-14: clicking a level label on the second skill sets the second skill", async () => {
      render(
        <>
          <ControlledLevel initial={3} />
          <ControlledLevel initial={3} />
        </>
      );
      const [first, second] = screen.getAllByRole("radiogroup");

      await userEvent.click(within(second).getByText("L5"));

      expect(checkedIn(second)).toBe(5);
      expect(checkedIn(first)).toBe(3);
    });
  });
});

describe("SkillPicker", () => {
  function renderPicker() {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(<SkillPicker open onOpenChange={onOpenChange} onSelect={onSelect} />);
    return { onSelect, onOpenChange };
  }

  it("lists the skill library and narrows it as the assessor types", async () => {
    server.use(http.get(`${API}/skill_taxonomies`, () => HttpResponse.json(skillTaxonomies)));
    renderPicker();

    expect(await screen.findByRole("button", { name: "React" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Communication" })).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("Search skills..."), "sys");

    expect(screen.getByRole("button", { name: "System Design" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "React" })).not.toBeInTheDocument();
  });

  it("says when nothing matches", async () => {
    server.use(http.get(`${API}/skill_taxonomies`, () => HttpResponse.json(skillTaxonomies)));
    renderPicker();
    await screen.findByRole("button", { name: "React" });

    await userEvent.type(screen.getByPlaceholderText("Search skills..."), "cobol");

    expect(screen.getByText("No skills found.")).toBeInTheDocument();
  });

  it("hands back the picked skill with its scope and anchors at L3, then closes", async () => {
    server.use(http.get(`${API}/skill_taxonomies`, () => HttpResponse.json(skillTaxonomies)));
    const { onSelect, onOpenChange } = renderPicker();

    await userEvent.click(await screen.findByRole("button", { name: "React" }));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        skill_label: "React", is_custom: false, expected_level: 3,
        scope_include: "React in production work", l1_anchor: "Needs close guidance.", l5_anchor: "Shapes practice across the org.",
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  describe("known defects", () => {
    // handleSelect sets skill_id: undefined, so assessment and vacancy skills are saved without their taxonomy id:
    // fit/gap can only match them by label, and the vacancy API can't look up their anchors.
    it.fails("P2-15: keeps the taxonomy skill id of the picked skill", async () => {
      server.use(http.get(`${API}/skill_taxonomies`, () => HttpResponse.json(skillTaxonomies)));
      const { onSelect } = renderPicker();

      await userEvent.click(await screen.findByRole("button", { name: "React" }));

      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ skill_id: "SK-ENG-001" }));
    });
  });
});
