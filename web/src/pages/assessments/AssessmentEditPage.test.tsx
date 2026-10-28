import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { getAssessment, updateAssessment } = vi.hoisted(() => ({
  getAssessment: vi.fn(),
  updateAssessment: vi.fn(),
}));

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    get: getAssessment,
    update: updateAssessment,
  },
}));

import AssessmentEditPage from "./AssessmentEditPage";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/edit"]}>
      <Routes>
        <Route
          path="/assessments/:id/edit"
          element={<AssessmentEditPage />}
        />
        <Route
          path="/assessments/:id/invite"
          element={<div>Invite page</div>}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("AssessmentEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getAssessment.mockResolvedValue({
      data: {
        assessment: {
          id: 1,
          name: "Frontend Engineer Interview",
          time_limit_min: 45,
          language: "id",
          skills: [
            {
              id: 10,
              skill_label: "React",
              expected_level: 3,
              display_order: 0,
              is_custom: false,
            },
          ],
        },
      },
    });

    updateAssessment.mockResolvedValue({ data: {} });
  });

  it("loads assessment details into the edit form", async () => {
    renderPage();

    expect(
      await screen.findByDisplayValue("Frontend Engineer Interview")
    ).toBeInTheDocument();

    expect(getAssessment).toHaveBeenCalledWith(1);
    expect(screen.getByText("React")).toBeInTheDocument();
  });

  it("rejects a role title containing only whitespace", async () => {
    const user = userEvent.setup();
    renderPage();

    const titleInput = await screen.findByLabelText(/role title/i);
    await user.clear(titleInput);
    await user.type(titleInput, "   ");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(
      await screen.findByText("Role title cannot be empty.")
    ).toBeInTheDocument();

    expect(updateAssessment).not.toHaveBeenCalled();
  });

  it("shows an error when saving fails", async () => {
    const user = userEvent.setup();
    updateAssessment.mockRejectedValueOnce(new Error("Network unavailable"));

    renderPage();

    await screen.findByDisplayValue("Frontend Engineer Interview");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(
      await screen.findByText(
        "We couldn't save your changes. Please try again."
      )
    ).toBeInTheDocument();

    expect(updateAssessment).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        name: "Frontend Engineer Interview",
        language: "id",
      })
    );
  });
});
