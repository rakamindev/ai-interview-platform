import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SkillPicker from "./SkillPicker";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";

vi.mock("@/services/skillTaxonomies", () => ({ skillTaxonomiesApi: { list: vi.fn() } }));

describe("Skill picker recovery", () => {
  it("distinguishes a failed request from no matches and retains the search on retry", async () => {
    vi.mocked(skillTaxonomiesApi.list)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ data: { skill_taxonomies: [{ skill_id: "communication", skill_label: "Communication" }] } } as any);
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(<SkillPicker open onSelect={onSelect} onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search skills" }), { target: { value: "comm" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load");
    expect(screen.queryByText("No skills found.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(await screen.findByRole("button", { name: "Communication" }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ skill_label: "Communication", expected_level: 3, is_custom: false }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
