import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssessmentNewPage from "@/pages/assessments/AssessmentNewPage";
import { assessmentsApi } from "@/services/assessments";
import type { Assessment } from "@/types";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/services/assessments", () => ({
  assessmentsApi: { create: vi.fn() },
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

function renderNewPage() {
  render(
    <MemoryRouter>
      <AssessmentNewPage />
    </MemoryRouter>
  );
}

async function fillCustomSkillFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^name/i), "Communication");
  await user.type(screen.getByLabelText(/what counts/i), "Clear written and verbal updates");
  await user.type(screen.getByLabelText(/l1 anchor/i), "Struggles to explain basic ideas");
  await user.type(screen.getByLabelText(/l2 anchor/i), "Explains with prompting");
  await user.type(screen.getByLabelText(/l3 anchor/i), "Explains clearly");
  await user.type(screen.getByLabelText(/l4 anchor/i), "Explains complex topics clearly");
  await user.type(screen.getByLabelText(/l5 anchor/i), "Communicates persuasively at scale");
}

describe("AssessmentNewPage", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    vi.mocked(assessmentsApi.create).mockReset();
  });

  it("renders the form fields and an empty-skills state", () => {
    renderNewPage();

    expect(screen.getByLabelText(/role title/i)).toBeInTheDocument();
    expect(screen.getByText(/session time limit/i)).toBeInTheDocument();
    expect(screen.getByText(/interview language/i)).toBeInTheDocument();
    expect(screen.getByText(/no skills added yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save & create session/i })).toBeInTheDocument();
  });

  it("blocks submission with a validation message when there are no skills", async () => {
    const user = userEvent.setup();
    renderNewPage();

    await user.type(screen.getByLabelText(/role title/i), "Senior Frontend Engineer");
    await user.click(screen.getByRole("button", { name: /save & create session/i }));

    const errorMessages = await screen.findAllByText(/add at least one skill to continue/i);
    expect(errorMessages.some((el) => el.classList.contains("text-destructive"))).toBe(true);
    expect(assessmentsApi.create).not.toHaveBeenCalled();
  });

  it("submits the expected payload after adding a custom skill, and navigates on success", async () => {
    vi.mocked(assessmentsApi.create).mockResolvedValueOnce({
      data: {
        assessment: { id: 42, name: "Senior Frontend Engineer", time_limit_min: 45 } as Assessment,
        system_prompt_generated: true,
      },
    } as never);
    const user = userEvent.setup();

    renderNewPage();

 
    const payload = vi.mocked(assessmentsApi.create).mock.calls[0][0];
    expect(payload.name).toBe("Senior Frontend Engineer");
    expect(payload.time_limit_min).toBe(45);
    expect(payload.language).toBe("en");
    expect(payload.assessment_skills_attributes).toHaveLength(1);
    expect(payload.assessment_skills_attributes[0]).toMatchObject({
      is_custom: true,
      expected_level: 3,
    });

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/assessments/42/invite")
    );
  });

  it("disables the submit button while the request is in flight", async () => {
    let resolveCreate!: (value: { data: { assessment: Assessment; system_prompt_generated: boolean } }) => void;
    vi.mocked(assessmentsApi.create).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }) as never
    );
    const user = userEvent.setup();

    renderNewPage();

    await user.type(screen.getByLabelText(/role title/i), "Senior Frontend Engineer");
    await user.click(screen.getByRole("button", { name: /add custom skill/i }));
    await fillCustomSkillFields(user);
    await user.click(screen.getByRole("button", { name: /save & create session/i }));

    expect(screen.getByRole("button", { name: /save & create session/i })).toBeDisabled();

    resolveCreate({
      data: {
        assessment: { id: 1, name: "x", time_limit_min: 45 } as Assessment,
        system_prompt_generated: true,
      },
    });
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
  });

  it("navigates back to /assessments when Cancel is clicked", async () => {
    const user = userEvent.setup();
    renderNewPage();

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(navigateMock).toHaveBeenCalledWith("/assessments");
  });
});
