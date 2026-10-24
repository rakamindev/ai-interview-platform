import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AxiosResponse } from "axios";

import SkillPicker from "./SkillPicker";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import type { SkillTaxonomy } from "@/types";

vi.mock("@/services/skillTaxonomies", () => ({
  skillTaxonomiesApi: { list: vi.fn() },
}));

const list = vi.mocked(skillTaxonomiesApi.list);

const taxonomy: SkillTaxonomy = {
  skill_id: "SK-ENG-001",
  skill_label: "React / Frontend Development Core",
  category: "engineering",
  scope_include: "React apps",
  scope_exclude: "Vue apps",
  l1_anchor: "L1",
  l2_anchor: "L2",
  l3_anchor: "L3",
  l4_anchor: "L4",
  l5_anchor: "L5",
};

afterEach(() => {
  cleanup();
});

describe("SkillPicker", () => {
  it("passes the taxonomy skill id to onSelect", async () => {
    list.mockResolvedValue({
      data: { skill_taxonomies: [taxonomy] },
    } as AxiosResponse<{ skill_taxonomies: SkillTaxonomy[] }>);
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();

    render(<SkillPicker open onOpenChange={onOpenChange} onSelect={onSelect} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "React / Frontend Development Core" })
    );

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        skill_id: "SK-ENG-001",
        skill_label: "React / Frontend Development Core",
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
