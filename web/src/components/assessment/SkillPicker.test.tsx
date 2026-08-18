import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SkillPicker from "./SkillPicker";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";

vi.mock("@/services/skillTaxonomies", () => ({
  skillTaxonomiesApi: { list: vi.fn() },
}));

const listMock = vi.mocked(skillTaxonomiesApi.list);

const TAXONOMY = [
  { skill_id: "SK-ENG-001", skill_label: "React / Frontend Development", category: "engineering", scope_include: "", scope_exclude: "", l1_anchor: "", l2_anchor: "", l3_anchor: "", l4_anchor: "", l5_anchor: "" },
  { skill_id: "SK-ENG-002", skill_label: "Node.js / Backend Development", category: "engineering", scope_include: "", scope_exclude: "", l1_anchor: "", l2_anchor: "", l3_anchor: "", l4_anchor: "", l5_anchor: "" },
];

describe("SkillPicker exclusion", () => {
  beforeEach(() => {
    listMock.mockResolvedValue({ data: { skill_taxonomies: TAXONOMY } } as any);
  });

  it("excludes already-added skills so duplicates are impossible", async () => {
    render(
      <SkillPicker
        open
        onOpenChange={() => {}}
        onSelect={() => {}}
        excludedLabels={["React / Frontend Development"]}
      />
    );

    await waitFor(() => expect(screen.getByText("Node.js / Backend Development")).toBeInTheDocument());
    expect(screen.queryByText("React / Frontend Development")).not.toBeInTheDocument();
  });

  it("still lets a fresh picker show every taxonomy skill", async () => {
    render(<SkillPicker open onOpenChange={() => {}} onSelect={() => {}} />);

    await waitFor(() => expect(screen.getByText("React / Frontend Development")).toBeInTheDocument());
    expect(screen.getByText("Node.js / Backend Development")).toBeInTheDocument();
  });

  it("shows an all-added message when nothing is left to pick", async () => {
    render(
      <SkillPicker
        open
        onOpenChange={() => {}}
        onSelect={() => {}}
        excludedLabels={["React / Frontend Development", "Node.js / Backend Development"]}
      />
    );

    await waitFor(() => expect(screen.getByText(/nothing left to pick/i)).toBeInTheDocument());
  });

  it("still calls onSelect with the picked skill", async () => {
    const onSelect = vi.fn();
    render(<SkillPicker open onOpenChange={() => {}} onSelect={onSelect} />);

    await waitFor(() => expect(screen.getByText("React / Frontend Development")).toBeInTheDocument());
    fireEvent.click(screen.getByText("React / Frontend Development"));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ skill_label: "React / Frontend Development" }));
  });
});