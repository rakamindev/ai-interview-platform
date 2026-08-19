import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";
import SkillPicker from "./SkillPicker";
import type { SkillTaxonomy } from "@/types";

const listMock = vi.hoisted(() => vi.fn());

vi.mock("@/services/skillTaxonomies", () => ({
  skillTaxonomiesApi: { list: listMock },
}));

const taxonomy: SkillTaxonomy = {
  skill_id: "7",
  skill_label: "Public Speaking",
  category: "communication",
  scope_include: "Structured delivery",
  scope_exclude: "Impromptu",
  l1_anchor: "Speaks clearly",
  l2_anchor: "",
  l3_anchor: "",
  l4_anchor: "",
  l5_anchor: "",
};

function renderPicker(onSelect = vi.fn()) {
  const onOpenChange = vi.fn();
  renderWithProviders(<SkillPicker open={true} onOpenChange={onOpenChange} onSelect={onSelect} />);
  return { onSelect, onOpenChange };
}

describe("SkillPicker", () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it("loads and lists taxonomy skills when opened", async () => {
    listMock.mockResolvedValue({ data: { skill_taxonomies: [taxonomy] } });
    renderPicker();
    await waitFor(() => expect(screen.getByText("Public Speaking")).toBeInTheDocument());
  });

  it("filters the list as the query changes", async () => {
    listMock.mockResolvedValue({
      data: {
        skill_taxonomies: [taxonomy, { ...taxonomy, skill_id: "9", skill_label: "SQL" }],
      },
    });
    renderPicker();
    await waitFor(() => expect(screen.getByText("Public Speaking")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText("Search skills..."), {
      target: { value: "sql" },
    });
    expect(screen.getByText("SQL")).toBeInTheDocument();
    expect(screen.queryByText("Public Speaking")).not.toBeInTheDocument();
  });

  it("selecting a skill reports the mapped payload and closes", async () => {
    listMock.mockResolvedValue({ data: { skill_taxonomies: [taxonomy] } });
    const { onSelect, onOpenChange } = renderPicker();
    await waitFor(() => expect(screen.getByText("Public Speaking")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Public Speaking"));
    expect(onSelect).toHaveBeenCalledWith({
      skill_id: undefined,
      skill_label: "Public Speaking",
      is_custom: false,
      expected_level: 3,
      scope_include: "Structured delivery",
      l1_anchor: "Speaks clearly",
      l2_anchor: "",
      l3_anchor: "",
      l4_anchor: "",
      l5_anchor: "",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows an empty message when nothing matches", async () => {
    listMock.mockResolvedValue({ data: { skill_taxonomies: [taxonomy] } });
    renderPicker();
    await waitFor(() => expect(screen.getByText("Public Speaking")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText("Search skills..."), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("No skills found.")).toBeInTheDocument();
  });

  it("recovers from a failed fetch by showing the empty state", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    listMock.mockRejectedValue(new Error("network down"));
    renderPicker();
    await waitFor(() => expect(screen.getByText("No skills found.")).toBeInTheDocument());
    consoleSpy.mockRestore();
  });
});
