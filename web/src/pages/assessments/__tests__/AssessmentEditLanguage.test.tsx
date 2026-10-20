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
  default: ({ index }: any) => (
    <div data-testid={`skill-card-${index}`}>
      <span>Skill Label {index}</span>
    </div>
  ),
}));

vi.mock("@/components/assessment/SkillPicker", () => ({
  default: () => null,
}));

describe("AssessmentEditPage - Language Field (FORM-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads existing language and sends language in update payload", async () => {
    vi.mocked(assessmentsApi.get).mockResolvedValueOnce({
      data: {
        assessment: {
          id: 42,
          name: "Engineering Lead Assessment",
          time_limit_min: 60,
          language: "id",
          skills: [
            { id: 201, skill_label: "System Architecture", expected_level: 4, is_custom: false, display_order: 0 },
          ],
        },
      },
    } as any);

    vi.mocked(assessmentsApi.update).mockResolvedValueOnce({ data: {} } as any);

    render(
      <MemoryRouter initialEntries={["/assessments/42/edit"]}>
        <Routes>
          <Route path="/assessments/:id/edit" element={<AssessmentEditPage />} />
          <Route path="/assessments/:id/invite" element={<div>Invite Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("skill-card-0")).toBeInTheDocument();
    });

    const languageTrigger = screen.getByTestId("select-language");
    expect(languageTrigger).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(assessmentsApi.update).toHaveBeenCalledTimes(1);
    });

    const updatePayload = vi.mocked(assessmentsApi.update).mock.calls[0][1];
    expect(updatePayload.language).toBe("id");
  });
});
