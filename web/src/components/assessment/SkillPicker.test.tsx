import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SkillPicker from "@/components/assessment/SkillPicker";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import type { SkillTaxonomy } from "@/types";

vi.mock("@/services/skillTaxonomies", () => ({ skillTaxonomiesApi: { list: vi.fn() } }));

const taxonomy = (skill_id: string, skill_label: string): SkillTaxonomy => ({
  skill_id,
  skill_label,
  category: "tech",
  scope_include: "",
  scope_exclude: "",
  l1_anchor: "",
  l2_anchor: "",
  l3_anchor: "",
  l4_anchor: "",
  l5_anchor: "",
});

describe("SkillPicker", () => {
  beforeEach(() => {
    vi.mocked(skillTaxonomiesApi.list).mockReset();
  });

  it("shows a retryable error instead of 'No skills found' when loading fails", async () => {
    vi.mocked(skillTaxonomiesApi.list)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({
        data: { skill_taxonomies: [taxonomy("SK-1", "React")] },
      } as Awaited<ReturnType<typeof skillTaxonomiesApi.list>>);
    const user = userEvent.setup();

    render(<SkillPicker open onOpenChange={vi.fn()} onSelect={vi.fn()} />);

    expect(await screen.findByText("Failed to load skills.")).toBeInTheDocument();
    expect(screen.queryByText("No skills found.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Retry/ }));
    expect(await screen.findByText("React")).toBeInTheDocument();
  });

  it("does not let a skill already on the form be added twice", async () => {
    vi.mocked(skillTaxonomiesApi.list).mockResolvedValue({
      data: { skill_taxonomies: [taxonomy("SK-1", "React"), taxonomy("SK-2", "Testing")] },
    } as Awaited<ReturnType<typeof skillTaxonomiesApi.list>>);

    render(<SkillPicker open onOpenChange={vi.fn()} onSelect={vi.fn()} addedLabels={["react "]} />);

    expect(await screen.findByRole("button", { name: /React/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Testing/ })).toBeEnabled();
  });
});
