import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AssessmentEditPage from "../AssessmentEditPage";
import { assessmentsApi } from "@/services/assessments";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    get: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/components/assessment/SkillCard", () => ({
  default: ({ onRemove, index, form }: any) => (
    <div data-testid={`skill-card-${index}`}>
      <span>Skill Label {index}</span>
      <button data-testid={`remove-skill-${index}`} type="button" onClick={onRemove}>
        Remove Skill
      </button>
    </div>
  ),
}));

vi.mock("@/components/assessment/SkillPicker", () => ({
  default: () => null,
}));

describe("AssessmentEditPage - Nested Attributes _destroy (FORM-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits _destroy: true for removed persisted skills", async () => {
    vi.mocked(assessmentsApi.get).mockResolvedValueOnce({
      data: {
        assessment: {
          id: 10,
          name: "Ruby Backend Assessment",
          time_limit_min: 30,
          skills: [
            { id: 101, skill_label: "Ruby on Rails", expected_level: 4, is_custom: false, display_order: 0 },
            { id: 102, skill_label: "PostgreSQL & SQL", expected_level: 3, is_custom: false, display_order: 1 },
          ],
        },
      },
    } as any);

    vi.mocked(assessmentsApi.update).mockResolvedValueOnce({ data: {} } as any);

    render(
      <MemoryRouter initialEntries={["/assessments/10/edit"]}>
        <Routes>
          <Route path="/assessments/:id/edit" element={<AssessmentEditPage />} />
          <Route path="/assessments/:id/invite" element={<div>Invite Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("skill-card-0")).toBeInTheDocument();
      expect(screen.getByTestId("skill-card-1")).toBeInTheDocument();
    });

    // Remove first skill (id: 101)
    fireEvent.click(screen.getByTestId("remove-skill-0"));

    // Save Changes
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(assessmentsApi.update).toHaveBeenCalledTimes(1);
    });

    const updatePayload = vi.mocked(assessmentsApi.update).mock.calls[0][1];
    expect(updatePayload.assessment_skills_attributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 102, display_order: 0 }),
        expect.objectContaining({ id: 101, _destroy: true }),
      ])
    );
  });
});
