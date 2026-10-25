import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssessmentNewPage from "@/pages/assessments/AssessmentNewPage";
import AssessmentEditPage from "@/pages/assessments/AssessmentEditPage";
import { assessmentsApi } from "@/services/assessments";
import { renderWithQueryClient } from "@/test/renderWithQueryClient";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/services/skillTaxonomies", () => ({
  skillTaxonomiesApi: { list: vi.fn() },
}));

const createMock = assessmentsApi.create as ReturnType<typeof vi.fn>;
const getMock = assessmentsApi.get as ReturnType<typeof vi.fn>;
const updateMock = assessmentsApi.update as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

function renderNewPage() {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={["/assessments/new"]}>
      <Routes>
        <Route path="/assessments/new" element={<AssessmentNewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderEditPage() {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={["/assessments/42/edit"]}>
      <Routes>
        <Route path="/assessments/:id/edit" element={<AssessmentEditPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("assessment skills frontend validation", () => {
  it("shows skills validation even when another required field is also invalid", async () => {
    const user = userEvent.setup();
    renderNewPage();

    await user.click(screen.getByRole("button", { name: /save & create session/i }));

    expect(screen.getByText("Role title is required")).toBeInTheDocument();
    const skillsGroup = screen.getByRole("group", { name: /skills to assess/i });
    expect(skillsGroup).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Add at least one skill before creating the assessment."
    );
    expect(createMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /add custom skill/i }));

    expect(skillsGroup).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText("Add at least one skill before creating the assessment.")).not.toBeInTheDocument();
  });

  it("shows the same field-level validation for a legacy empty assessment", async () => {
    getMock.mockResolvedValue({
      data: {
        assessment: {
          id: 42,
          name: "Legacy Assessment",
          time_limit_min: 30,
          skills: [],
        },
      },
    });

    const user = userEvent.setup();
    renderEditPage();

    await screen.findByDisplayValue("Legacy Assessment");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(screen.getByRole("group", { name: /skills to assess/i })).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Add at least one skill before saving the assessment."
    );
    expect(updateMock).not.toHaveBeenCalled();
  });
});
