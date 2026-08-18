import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SkillPicker from "@/components/assessment/SkillPicker";
import * as skillTaxonomiesApi from "@/services/skillTaxonomies";
import type { AssessmentSkill } from "@/types";

// Mock the API
vi.mock("@/services/skillTaxonomies", () => ({
  skillTaxonomiesApi: {
    list: vi.fn(),
  },
}));

const mockSkills = [
  {
    skill_id: 1,
    skill_label: "Problem Solving",
    scope_include: "scope A",
    l1_anchor: "l1",
    l2_anchor: "l2",
    l3_anchor: "l3",
    l4_anchor: "l4",
    l5_anchor: "l5",
  },
  {
    skill_id: 2,
    skill_label: "Communication",
    scope_include: "scope B",
    l1_anchor: "l1",
    l2_anchor: "l2",
    l3_anchor: "l3",
    l4_anchor: "l4",
    l5_anchor: "l5",
  },
  {
    skill_id: 3,
    skill_label: "Leadership",
    scope_include: "scope C",
    l1_anchor: "l1",
    l2_anchor: "l2",
    l3_anchor: "l3",
    l4_anchor: "l4",
    l5_anchor: "l5",
  },
];

describe("SkillPicker", () => {
  beforeEach(() => {
    vi.mocked(skillTaxonomiesApi.skillTaxonomiesApi.list).mockResolvedValue({
      data: { skill_taxonomies: mockSkills },
    } as never);
  });

  it("renders skill list when open", async () => {
    render(<SkillPicker open={true} onOpenChange={vi.fn()} onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Problem Solving")).toBeInTheDocument();
      expect(screen.getByText("Communication")).toBeInTheDocument();
      expect(screen.getByText("Leadership")).toBeInTheDocument();
    });
  });

  it("marks already-selected skills as disabled", async () => {
    render(
      <SkillPicker
        open={true}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
        selectedLabels={["Problem Solving"]}
      />,
    );

    await waitFor(() => {
      const checkbox = screen.getAllByRole("checkbox")[0];
      expect(checkbox).toBeChecked();
      expect(checkbox).toBeDisabled();
    });
  });

  it("does not call onSelect when Add button is clicked with no new selection", async () => {
    const onSelect = vi.fn();
    render(<SkillPicker open={true} onOpenChange={vi.fn()} onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Problem Solving")).toBeInTheDocument();
    });

    const addButton = screen.getByRole("button", { name: /add/i });
    expect(addButton).toBeDisabled();
  });

  it("calls onSelect with multiple selected skills and closes", async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();

    render(<SkillPicker open={true} onOpenChange={onOpenChange} onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Communication")).toBeInTheDocument();
    });

    // Select two skills
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]); // Problem Solving
    fireEvent.click(checkboxes[1]); // Communication

    const addButton = screen.getByRole("button", { name: /add \(2\)/i });
    expect(addButton).not.toBeDisabled();
    fireEvent.click(addButton);

    expect(onSelect).toHaveBeenCalledOnce();
    const selected: Partial<AssessmentSkill>[] = onSelect.mock.calls[0][0];
    expect(selected).toHaveLength(2);
    expect(selected[0].skill_label).toBe("Problem Solving");
    expect(selected[1].skill_label).toBe("Communication");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("prevents duplicate selection via selectedLabels", async () => {
    render(
      <SkillPicker
        open={true}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
        selectedLabels={["Communication", "Leadership"]}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText("Added")).toHaveLength(2);
    });

    const disabledCheckboxes = screen
      .getAllByRole("checkbox")
      .filter((cb) => (cb as HTMLInputElement).disabled);
    expect(disabledCheckboxes).toHaveLength(2);
  });

  it("filters skills by search query", async () => {
    render(<SkillPicker open={true} onOpenChange={vi.fn()} onSelect={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Problem Solving")).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText("Search skills...");
    fireEvent.change(searchInput, { target: { value: "lead" } });

    expect(screen.queryByText("Problem Solving")).not.toBeInTheDocument();
    expect(screen.queryByText("Communication")).not.toBeInTheDocument();
    expect(screen.getByText("Leadership")).toBeInTheDocument();
  });

  it("closes dialog on Cancel", async () => {
    const onOpenChange = vi.fn();
    render(<SkillPicker open={true} onOpenChange={onOpenChange} onSelect={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Problem Solving")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
