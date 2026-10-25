import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AssessmentEditPage from "./AssessmentEditPage";
import { assessmentsApi } from "@/services/assessments";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    get: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: {},
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  })),
}));

const mockedAssessmentsApi = vi.mocked(assessmentsApi);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/42/edit"]}>
      <Routes>
        <Route path="/assessments/:id/edit" element={<AssessmentEditPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AssessmentEditPage", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    mockedAssessmentsApi.get.mockResolvedValue({
      data: {
        assessment: {
          id: 42,
          name: "Frontend Engineer",
          time_limit_min: 45,
          skills: [
            {
              id: 7,
              skill_label: "React",
              skill_id: 1,
              expected_level: 3,
              is_custom: false,
            },
            {
              id: 8,
              skill_label: "TypeScript",
              skill_id: 2,
              expected_level: 3,
              is_custom: false,
            },
          ],
        },
      },
    } as never);
  });

  it("preserves edited input and reports validation feedback when saving a removed skill fails", async () => {
    const user = userEvent.setup();
    mockedAssessmentsApi.update.mockRejectedValue({
      response: { data: { errors: [{ message: "Name is already taken" }] } },
    });

    renderPage();

    const nameInput = await screen.findByLabelText(/role title/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Senior Frontend Engineer");
    const reactCard = (await screen.findByText("React")).closest("div.border");
    expect(reactCard).not.toBeNull();
    await user.click(within(reactCard as HTMLElement).getByRole("button", { name: /remove skill/i }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockedAssessmentsApi.update).toHaveBeenCalledWith(42, {
      name: "Senior Frontend Engineer",
      time_limit_min: 45,
      assessment_skills_attributes: [
        {
          id: 8,
          skill_label: "TypeScript",
          skill_id: 2,
          expected_level: 3,
          is_custom: false,
          display_order: 0,
        },
        { id: 7, _destroy: true },
      ],
    }));

    expect(await screen.findByText("Name is already taken")).toBeVisible();
    expect(nameInput).toHaveValue("Senior Frontend Engineer");
    expect(screen.queryByText("React")).not.toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeVisible();
  });

  it("enables saving when an expected skill level changes", async () => {
    const user = userEvent.setup();
    renderPage();

    const reactCard = (await screen.findByText("React")).closest("div.border");
    expect(reactCard).not.toBeNull();
    await user.click(await within(reactCard as HTMLElement).findByText("React"));

    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
    await user.click(within(reactCard as HTMLElement).getByRole("radio", { name: "L2" }));

    expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled();
  });

  it("shows an actionable error when the assessment cannot be loaded", async () => {
    mockedAssessmentsApi.get.mockRejectedValue(new Error("network failure"));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to load this assessment/i);
    expect(screen.getByRole("link", { name: /back to assessment/i })).toBeVisible();
  });
});
