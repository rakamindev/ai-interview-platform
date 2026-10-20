import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import VacancyNewPage from "../VacancyNewPage";
import { vacanciesApi } from "@/services/vacancies";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";

vi.mock("@/services/vacancies", () => ({
  vacanciesApi: {
    create: vi.fn(),
  },
}));

vi.mock("@/services/skillTaxonomies", () => ({
  skillTaxonomiesApi: {
    list: vi.fn().mockResolvedValue({ data: { skill_taxonomies: [] } }),
    create: vi.fn().mockResolvedValue({
      data: {
        skill: {
          id: 1,
          skill_id: "consensus_algorithms",
          skill_label: "Consensus Algorithms",
          category: "engineering",
        },
      },
    }),
  },
}));

describe("VacancyCustomCompetency Builder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders full custom competency form with rubric anchors and scope include", () => {
    render(
      <MemoryRouter>
        <VacancyNewPage />
      </MemoryRouter>
    );

    // Click "Add Custom Competency"
    const addCustomBtn = screen.getByRole("button", { name: /Add Custom Competency/i });
    fireEvent.click(addCustomBtn);

    // Verify all custom competency form elements are present
    expect(screen.getByText(/Custom Competency Requirement/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. Distributed Consensus, Domain-Driven Design/i)).toBeInTheDocument();
    expect(screen.getByText(/Category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/What counts \(scope include\)/i)).toBeInTheDocument();

    // Verify rubric anchors configuration toggle
    const anchorsToggle = screen.getByRole("button", { name: /Configure Proficiency Rubric Anchors/i });
    expect(anchorsToggle).toBeInTheDocument();

    fireEvent.click(anchorsToggle);
    expect(screen.getByText(/L1 Anchor/i)).toBeInTheDocument();
    expect(screen.getByText(/L5 Anchor/i)).toBeInTheDocument();
  });

  it("appends custom competency requirement, syncs to skill library, and submits with is_custom flag", async () => {
    vi.mocked(vacanciesApi.create).mockResolvedValue({ data: { vacancy: { id: 10 } } } as any);

    render(
      <MemoryRouter>
        <VacancyNewPage />
      </MemoryRouter>
    );

    // Fill role title
    const roleInput = screen.getByLabelText(/Role title/i);
    fireEvent.change(roleInput, { target: { value: "Lead Distributed Systems Engineer" } });

    // Click "Add Custom Competency"
    const addCustomBtn = screen.getByRole("button", { name: /Add Custom Competency/i });
    fireEvent.click(addCustomBtn);

    // Expect custom competency input to appear
    const customInput = screen.getByPlaceholderText(/e\.g\. Distributed Consensus, Domain-Driven Design/i);
    expect(customInput).toBeInTheDocument();

    fireEvent.change(customInput, { target: { value: "Consensus Algorithms" } });

    // Click "Save to Skill Library Now"
    const saveToLibBtn = screen.getByRole("button", { name: /Save to Skill Library Now/i });
    fireEvent.click(saveToLibBtn);

    await waitFor(() => {
      expect(skillTaxonomiesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          skill_label: "Consensus Algorithms",
          category: "engineering",
        })
      );
      expect(screen.getByText(/In Skill Library/i)).toBeInTheDocument();
    });

    // Submit the vacancy
    const submitBtn = screen.getByRole("button", { name: /Save Vacancy/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(vacanciesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role_title: "Lead Distributed Systems Engineer",
          vacancy_skills_attributes: [
            expect.objectContaining({
              skill_label: "Consensus Algorithms",
              is_custom: true,
              expected_level: 3,
            }),
          ],
        })
      );
    });
  });
});
