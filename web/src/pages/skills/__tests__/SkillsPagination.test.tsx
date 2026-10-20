import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SkillsPage from "../SkillsPage";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";

vi.mock("@/services/skillTaxonomies", () => ({
  skillTaxonomiesApi: {
    list: vi.fn(),
    create: vi.fn(),
    bulkCreate: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("SkillsPage - Standardized Header & Pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders standardized title and description without icons in title", async () => {
    vi.mocked(skillTaxonomiesApi.list).mockResolvedValue({
      data: { skill_taxonomies: [] },
    } as any);

    render(<SkillsPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Skill Library" })).toBeInTheDocument();
      expect(
        screen.getByText("Standard and custom competencies with L1–L5 proficiency rubric anchors.")
      ).toBeInTheDocument();
    });
  });

  it("paginates skills and navigates to the next page", async () => {
    // Generate 15 skills to test pagination with PAGE_SIZE = 10
    const mockSkills = Array.from({ length: 15 }, (_, i) => ({
      skill_id: `skill_${i + 1}`,
      skill_label: `Skill Test ${i + 1}`,
      category: "engineering",
      scope_include: "Sample inclusion",
      scope_exclude: "Sample exclusion",
      l1_anchor: "Novice",
      l2_anchor: "Advanced Beginner",
      l3_anchor: "Competent Autonomous",
      l4_anchor: "Proficient",
      l5_anchor: "Expert",
    }));

    vi.mocked(skillTaxonomiesApi.list).mockResolvedValue({
      data: { skill_taxonomies: mockSkills },
    } as any);

    render(<SkillsPage />);

    await waitFor(() => {
      expect(screen.getByText("Skill Test 1")).toBeInTheDocument();
      expect(screen.getByText("Skill Test 10")).toBeInTheDocument();
    });

    // Page 1 should not show item 11
    expect(screen.queryByText("Skill Test 11")).not.toBeInTheDocument();
    expect(screen.getByText(/Showing 1–10 of 15 skills/i)).toBeInTheDocument();

    // Click page 2 button
    const page2Button = screen.getByRole("button", { name: "Page 2" });
    fireEvent.click(page2Button);

    // Now item 11 should be visible, item 1 should not
    expect(screen.getByText("Skill Test 11")).toBeInTheDocument();
    expect(screen.getByText("Skill Test 15")).toBeInTheDocument();
    expect(screen.queryByText("Skill Test 1")).not.toBeInTheDocument();
    expect(screen.getByText(/Showing 11–15 of 15 skills/i)).toBeInTheDocument();
  });
});
