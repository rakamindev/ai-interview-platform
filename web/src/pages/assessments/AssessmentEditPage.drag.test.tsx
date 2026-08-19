import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { renderWithProviders } from "@/test/utils";
import { fireEvent, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { Routes, Route } from "react-router-dom";
import AssessmentEditPage from "./AssessmentEditPage";

const { assessmentsApiMock, dragEndRef, sortableIds } = vi.hoisted(() => ({
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
  dragEndRef: {
    current: null as null | ((e: { active: { id: string }; over: { id: string } | null }) => void),
  },
  sortableIds: [] as string[],
}));

vi.mock("@/services/assessments", () => ({ assessmentsApi: assessmentsApiMock }));
vi.mock("@/services/skillTaxonomies", () => ({ skillTaxonomiesApi: { list: vi.fn() } }));
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

const twoSkill = {
  id: 5,
  name: "Backend",
  role_title: "Backend",
  time_limit_min: 60,
  skills: [
    { skill_label: "React", is_custom: false, expected_level: 3, scope_include: "components" },
    { skill_label: "SQL", is_custom: false, expected_level: 3, scope_include: "queries" },
  ],
};

function renderEdit() {
  renderWithProviders(
    <Routes>
      <Route path="/assessments/:id/edit" element={<AssessmentEditPage />} />
      <Route path="/assessments/:id/invite" element={<div>INVITE PAGE</div>} />
    </Routes>,
    { route: "/assessments/5/edit" },
  );
}

describe("AssessmentEditPage drag reorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sortableIds.length = 0;
    assessmentsApiMock.get.mockResolvedValue({ data: { assessment: twoSkill } });
    assessmentsApiMock.update.mockResolvedValue({
      data: { assessment: twoSkill, system_prompt_generated: true },
    });
  });

  it("reorders skills on drag end and persists the new order", async () => {
    renderEdit();
    await screen.findByDisplayValue("Backend");

    const uniqueIds = [...new Set(sortableIds)];
    expect(uniqueIds.length).toBeGreaterThanOrEqual(2);
    dragEndRef.current?.({ active: { id: uniqueIds[0] }, over: { id: uniqueIds[1] } });

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByText("INVITE PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(assessmentsApiMock.update).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        assessment_skills_attributes: [
          expect.objectContaining({ skill_label: "SQL", display_order: 0 }),
          expect.objectContaining({ skill_label: "React", display_order: 1 }),
        ],
      }),
    );
  });

  it("ignores a drag onto the same item or with no target", async () => {
    renderEdit();
    await screen.findByDisplayValue("Backend");

    dragEndRef.current?.({ active: { id: "same" }, over: { id: "same" } });
    dragEndRef.current?.({ active: { id: "x" }, over: null });
  });
});
