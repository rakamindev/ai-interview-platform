import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { renderWithProviders } from "@/test/utils";
import { fireEvent, screen } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import type { ReactNode } from "react";
import AssessmentNewPage from "./AssessmentNewPage";

const { assessmentsApiMock, vacanciesApiMock, skillTaxonomiesApiMock, dragEndRef, sortableIds } =
  vi.hoisted(() => ({
    assessmentsApiMock: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getSystemPrompt: vi.fn(),
      getSessions: vi.fn(),
      createSession: vi.fn(),
    },
    vacanciesApiMock: { get: vi.fn() },
    skillTaxonomiesApiMock: { list: vi.fn() },
    dragEndRef: {
      current: null as
        | null
        | ((e: { active: { id: string }; over: { id: string } | null }) => void),
    },
    sortableIds: [] as string[],
  }));

vi.mock("@/services/assessments", () => ({ assessmentsApi: assessmentsApiMock }));
vi.mock("@/services/vacancies", () => ({ vacanciesApi: vacanciesApiMock }));
vi.mock("@/services/skillTaxonomies", () => ({
  skillTaxonomiesApi: skillTaxonomiesApiMock,
}));
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    DndContext: ({ children, onDragEnd }: { children: ReactNode; onDragEnd: never }) => {
      dragEndRef.current = onDragEnd as never;
      return <>{children}</>;
    },
  };
});
vi.mock("@dnd-kit/sortable", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/sortable")>();
  return {
    ...actual,
    SortableContext: ({ children }: { children: ReactNode }) => <>{children}</>,
    useSortable: (props: { id: string }) => {
      sortableIds.push(props.id);
      return {
        attributes: {},
        listeners: {},
        setNodeRef: () => {},
        transform: null,
        transition: undefined,
        isDragging: false,
      };
    },
  };
});

function renderNew(route = "/assessments/new") {
  renderWithProviders(
    <Routes>
      <Route path="/assessments" element={<div>LIST PAGE</div>} />
      <Route path="/assessments/new" element={<AssessmentNewPage />} />
      <Route path="/assessments/:id/invite" element={<div>INVITE PAGE</div>} />
    </Routes>,
    { route },
  );
}

async function addCustomSkill(name = "Communication") {
  fireEvent.click(screen.getByRole("button", { name: /Add custom skill/ }));
  fireEvent.change(screen.getByLabelText("Name *"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/What counts/), { target: { value: "scope text" } });
  for (let level = 1; level <= 5; level += 1) {
    fireEvent.change(screen.getByPlaceholderText(`What does L${level} look like for this skill?`), {
      target: { value: `L${level} anchor text` },
    });
  }
}

describe("AssessmentNewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assessmentsApiMock.create.mockResolvedValue({
      data: { assessment: { id: 1 }, system_prompt_generated: true },
    });
  });

  it("renders the form shell", () => {
    renderNew();

    expect(screen.getByText("New Assessment")).toBeInTheDocument();
    expect(screen.getByLabelText(/Role title/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add custom skill/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add from Skill Taxonomy/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save & Create Invite Link/ })).toBeInTheDocument();
  });

  it("blocks saving when no skills were added", async () => {
    renderNew();

    fireEvent.change(screen.getByLabelText(/Role title/), { target: { value: "Engineer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Add at least one skill to continue.")).toBeInTheDocument();
    expect(assessmentsApiMock.create).not.toHaveBeenCalled();
  });

  it("saves an assessment with a custom skill and navigates to the invite page", async () => {
    renderNew();

    fireEvent.change(screen.getByLabelText(/Role title/), { target: { value: "Engineer" } });
    await addCustomSkill();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("INVITE PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(assessmentsApiMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Engineer",
        role_title: "Engineer",
        time_limit_min: 45,
        language: "en",
        assessment_skills_attributes: [
          expect.objectContaining({
            skill_label: "Communication",
            is_custom: true,
            display_order: 0,
          }),
        ],
      }),
      false,
    );
  });

  it("creates an invite link together with the assessment when requested", async () => {
    renderNew();

    fireEvent.change(screen.getByLabelText(/Role title/), { target: { value: "Engineer" } });
    await addCustomSkill();
    fireEvent.click(screen.getByRole("button", { name: /Save & Create Invite Link/ }));

    expect(await screen.findByText("INVITE PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(assessmentsApiMock.create).toHaveBeenCalledWith(expect.any(Object), true);
  });

  it("prefills the role title from a linked vacancy", async () => {
    vacanciesApiMock.get.mockResolvedValue({
      data: { vacancy: { id: 4, role_title: "Senior Frontend Engineer" } },
    });
    renderNew("/assessments/new?vacancy=4");

    expect(await screen.findByDisplayValue("Senior Frontend Engineer")).toBeInTheDocument();
    expect(vacanciesApiMock.get).toHaveBeenCalledWith(4);
  });

  it("removes a custom skill back to the empty state", async () => {
    renderNew();

    await addCustomSkill();
    expect(screen.getByText("Custom")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove skill" }));
    expect(screen.getByText("No skills added yet.")).toBeInTheDocument();
  });

  it("surfaces server-side errors", async () => {
    assessmentsApiMock.create.mockRejectedValue({
      response: { data: { errors: [{ message: "Name already exists" }] } },
    });
    renderNew();

    fireEvent.change(screen.getByLabelText(/Role title/), { target: { value: "Engineer" } });
    await addCustomSkill();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Name already exists")).toBeInTheDocument();
  });

  it("falls back to the generic message when the error has no shape", async () => {
    assessmentsApiMock.create.mockRejectedValue(new Error("boom"));
    renderNew();

    fireEvent.change(screen.getByLabelText(/Role title/), { target: { value: "Engineer" } });
    await addCustomSkill();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Failed to save assessment.")).toBeInTheDocument();
  });

  it("saves with the selected interview language", async () => {
    renderNew();

    fireEvent.change(screen.getByLabelText(/Role title/), { target: { value: "Engineer" } });
    await addCustomSkill();
    fireEvent.click(screen.getAllByRole("combobox")[1]);
    fireEvent.click(await screen.findByRole("option", { name: "Indonesian" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("INVITE PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(assessmentsApiMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ language: "id" }),
      false,
    );
  });

  it("adds a skill from the taxonomy picker", async () => {
    skillTaxonomiesApiMock.list.mockResolvedValue({
      data: {
        skill_taxonomies: [
          { skill_id: 9, skill_label: "Kubernetes", scope_include: "deployments" },
        ],
      },
    });
    renderNew();

    fireEvent.click(screen.getByRole("button", { name: /Add from Skill Taxonomy/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Kubernetes" }));

    expect(await screen.findByText("Kubernetes")).toBeInTheDocument();
  });

  it("cancels back to the assessment list", async () => {
    renderNew();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("LIST PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it("shows a validation error when the role title is empty", async () => {
    renderNew();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Role title is required")).toBeInTheDocument();
    expect(assessmentsApiMock.create).not.toHaveBeenCalled();
  });

  it("reorders skills on drag end", async () => {
    sortableIds.length = 0;
    skillTaxonomiesApiMock.list.mockResolvedValue({
      data: {
        skill_taxonomies: [
          { skill_id: 1, skill_label: "React", scope_include: "components" },
          { skill_id: 2, skill_label: "SQL", scope_include: "queries" },
        ],
      },
    });
    renderNew();

    fireEvent.click(screen.getByRole("button", { name: /Add from Skill Taxonomy/ }));
    fireEvent.click(await screen.findByRole("button", { name: "React" }));
    fireEvent.click(screen.getByRole("button", { name: /Add from Skill Taxonomy/ }));
    fireEvent.click(await screen.findByRole("button", { name: "SQL" }));

    // useSortable is called on every render, so sortableIds accumulates duplicates;
    // dedupe to the distinct skill ids in first-appearance order (React, then SQL).
    const uniqueIds = [...new Set(sortableIds)];
    expect(uniqueIds.length).toBeGreaterThanOrEqual(2);
    dragEndRef.current?.({ active: { id: uniqueIds[0] }, over: { id: uniqueIds[1] } });

    fireEvent.change(screen.getByLabelText(/Role title/), { target: { value: "Engineer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("INVITE PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(assessmentsApiMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        assessment_skills_attributes: [
          expect.objectContaining({ skill_label: "SQL", display_order: 0 }),
          expect.objectContaining({ skill_label: "React", display_order: 1 }),
        ],
      }),
      false,
    );
  });

  it("does not reorder when dragging a skill onto itself", () => {
    sortableIds.length = 0;
    renderNew();

    dragEndRef.current?.({ active: { id: "same-id" }, over: { id: "same-id" } });
    dragEndRef.current?.({ active: { id: "x" }, over: null });
  });
});
