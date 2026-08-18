import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssessmentEditPage from "@/pages/assessments/AssessmentEditPage";
import { assessmentsApi } from "@/services/assessments";
import type { Assessment } from "@/types";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/services/assessments", () => ({
  assessmentsApi: { get: vi.fn(), update: vi.fn() },
}));

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  SortableContext: ({ children }: { children: React.ReactNode }) => children,
  sortableKeyboardCoordinates: () => {},
  verticalListSortingStrategy: () => {},
  arrayMove: <T,>(arr: T[]) => arr,
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

if (!("ResizeObserver" in globalThis)) {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

function renderEditPage() {
  render(
    <MemoryRouter initialEntries={["/assessments/1/edit"]}>
      <Routes>
        <Route path="/assessments/:id/edit" element={<AssessmentEditPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const baseAssessment: Assessment = {
  id: 1,
  name: "Senior Frontend Engineer",
  time_limit_min: 45,
  skills: [
    {
      skill_label: "Communication",
      is_custom: true,
      expected_level: 3,
      display_order: 0,
      scope_include: "Clear written and verbal updates",
      l1_anchor: "Struggles to explain basic ideas",
      l2_anchor: "Explains with prompting",
      l3_anchor: "Explains clearly",
      l4_anchor: "Explains complex topics clearly",
      l5_anchor: "Communicates persuasively at scale",
    },
  ],
};

describe("AssessmentEditPage", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    vi.mocked(assessmentsApi.get).mockReset();
    vi.mocked(assessmentsApi.update).mockReset();
  });

  it("shows a loading skeleton while fetching, then renders the populated form", async () => {
    let resolveGet!: (value: { data: { assessment: Assessment } }) => void;
    vi.mocked(assessmentsApi.get).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveGet = resolve;
      }) as never
    );

    const { container } = render(
      <MemoryRouter initialEntries={["/assessments/1/edit"]}>
        <Routes>
          <Route path="/assessments/:id/edit" element={<AssessmentEditPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);

    resolveGet({ data: { assessment: baseAssessment } });

    expect(await screen.findByDisplayValue("Senior Frontend Engineer")).toBeInTheDocument();
    expect(screen.getByText("Communication")).toBeInTheDocument();
  });

  it("shows an empty-skills state when the assessment has no skills", async () => {
    vi.mocked(assessmentsApi.get).mockResolvedValueOnce({
      data: { assessment: { ...baseAssessment, skills: [] } },
    } as never);

    renderEditPage();

    expect(await screen.findByText(/no skills added yet/i)).toBeInTheDocument();
  });

  it("submits the update payload and navigates to the invite page on success", async () => {
    vi.mocked(assessmentsApi.get).mockResolvedValueOnce({
      data: { assessment: baseAssessment },
    } as never);
    vi.mocked(assessmentsApi.update).mockResolvedValueOnce({
      data: { assessment: baseAssessment, system_prompt_generated: true },
    } as never);
    const user = userEvent.setup();

    renderEditPage();

    await screen.findByDisplayValue("Senior Frontend Engineer");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(assessmentsApi.update).toHaveBeenCalled());
    const [id, payload] = vi.mocked(assessmentsApi.update).mock.calls[0];
    expect(id).toBe(1);
    expect(payload.name).toBe("Senior Frontend Engineer");
    expect(payload.time_limit_min).toBe(45);
    expect(payload.assessment_skills_attributes).toHaveLength(1);

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/assessments/1/invite")
    );
  });

  it("shows a validation error and does not submit when all skills are removed", async () => {
    vi.mocked(assessmentsApi.get).mockResolvedValueOnce({
      data: { assessment: baseAssessment },
    } as never);
    const user = userEvent.setup();

    renderEditPage();

    await screen.findByDisplayValue("Senior Frontend Engineer");
    await user.click(screen.getByRole("button", { name: /remove skill/i }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText(/add at least one skill/i)).toBeInTheDocument();
    expect(assessmentsApi.update).not.toHaveBeenCalled();
  });

  it("disables the Save Changes button while the update request is in flight", async () => {
    vi.mocked(assessmentsApi.get).mockResolvedValueOnce({
      data: { assessment: baseAssessment },
    } as never);
    let resolveUpdate!: (value: { data: { assessment: Assessment; system_prompt_generated: boolean } }) => void;
    vi.mocked(assessmentsApi.update).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }) as never
    );
    const user = userEvent.setup();

    renderEditPage();

    await screen.findByDisplayValue("Senior Frontend Engineer");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();

    resolveUpdate({
      data: { assessment: baseAssessment, system_prompt_generated: true },
    });
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
  });
});
