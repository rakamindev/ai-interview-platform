import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { renderWithProviders } from "@/test/utils";
import { fireEvent, screen } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import AssessmentEditPage from "./AssessmentEditPage";

const { assessmentsApiMock, skillTaxonomiesApiMock } = vi.hoisted(() => ({
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
  skillTaxonomiesApiMock: { list: vi.fn() },
}));

vi.mock("@/services/assessments", () => ({ assessmentsApi: assessmentsApiMock }));
vi.mock("@/services/skillTaxonomies", () => ({
  skillTaxonomiesApi: skillTaxonomiesApiMock,
}));

const loadedAssessment = {
  id: 5,
  name: "Backend Engineer",
  role_title: "Backend Engineer",
  time_limit_min: 60,
  skills: [
    {
      skill_label: "SQL",
      is_custom: true,
      expected_level: 4,
      scope_include: "query design",
      l1_anchor: "reads simple queries",
      l2_anchor: "writes joins",
      l3_anchor: "optimizes indexes",
      l4_anchor: "designs schemas",
      l5_anchor: "architects data platform",
    },
  ],
};

function renderEdit() {
  renderWithProviders(
    <Routes>
      <Route path="/assessments" element={<div>LIST PAGE</div>} />
      <Route path="/assessments/:id/edit" element={<AssessmentEditPage />} />
      <Route path="/assessments/:id/invite" element={<div>INVITE PAGE</div>} />
    </Routes>,
    { route: "/assessments/5/edit" },
  );
}

describe("AssessmentEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assessmentsApiMock.get.mockResolvedValue({ data: { assessment: loadedAssessment } });
    assessmentsApiMock.update.mockResolvedValue({
      data: { assessment: loadedAssessment, system_prompt_generated: true },
    });
  });

  it("renders loading skeletons while fetching", () => {
    assessmentsApiMock.get.mockReturnValue(new Promise(() => {}));
    renderEdit();

    expect(document.querySelectorAll(".animate-pulse")).toHaveLength(4);
  });

  it("loads the assessment into the form", async () => {
    renderEdit();

    expect(await screen.findByDisplayValue("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("SQL")).toBeInTheDocument();
    expect(assessmentsApiMock.get).toHaveBeenCalledWith(5);
  });

  it("saves changes and navigates to the invite page", async () => {
    renderEdit();
    await screen.findByDisplayValue("Backend Engineer");

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("INVITE PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(assessmentsApiMock.update).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        name: "Backend Engineer",
        role_title: "Backend Engineer",
        time_limit_min: 60,
        assessment_skills_attributes: [
          expect.objectContaining({ skill_label: "SQL", display_order: 0 }),
        ],
      }),
    );
  });

  it("blocks saving when no skills are present", async () => {
    assessmentsApiMock.get.mockResolvedValue({
      data: {
        assessment: { id: 5, name: "Empty", role_title: "Empty", time_limit_min: 45, skills: [] },
      },
    });
    renderEdit();
    await screen.findByDisplayValue("Empty");

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("Add at least one skill.")).toBeInTheDocument();
    expect(assessmentsApiMock.update).not.toHaveBeenCalled();
  });

  it("adds and removes custom skills via the UI", async () => {
    assessmentsApiMock.get.mockResolvedValue({
      data: {
        assessment: { id: 5, name: "Empty", role_title: "Empty", time_limit_min: 45, skills: [] },
      },
    });
    renderEdit();
    await screen.findByDisplayValue("Empty");

    fireEvent.click(screen.getByRole("button", { name: /Add custom skill/ }));
    expect(screen.getByText("Custom")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove skill" }));
    expect(screen.getByText("No skills added yet.")).toBeInTheDocument();
  });

  it("surfaces server-side errors", async () => {
    assessmentsApiMock.update.mockRejectedValue({
      response: { data: { errors: [{ message: "Name taken" }] } },
    });
    renderEdit();
    await screen.findByDisplayValue("Backend Engineer");

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("Name taken")).toBeInTheDocument();
  });

  it("falls back to the generic message when the error has no shape", async () => {
    assessmentsApiMock.update.mockRejectedValue(new Error("boom"));
    renderEdit();
    await screen.findByDisplayValue("Backend Engineer");

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("Failed to save.")).toBeInTheDocument();
  });

  it("changes the time limit before saving", async () => {
    renderEdit();
    await screen.findByDisplayValue("Backend Engineer");

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "45 min" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("INVITE PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(assessmentsApiMock.update).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ time_limit_min: 45 }),
    );
  });

  it("adds a skill from the taxonomy picker", async () => {
    skillTaxonomiesApiMock.list.mockResolvedValue({
      data: {
        skill_taxonomies: [
          { skill_id: 7, skill_label: "Kubernetes", scope_include: "deployments" },
        ],
      },
    });
    renderEdit();
    await screen.findByDisplayValue("Backend Engineer");

    fireEvent.click(screen.getByRole("button", { name: /Add from B7 taxonomy/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Kubernetes" }));

    expect(await screen.findByText("Kubernetes")).toBeInTheDocument();
  });

  it("cancels back to the invite page", async () => {
    renderEdit();
    await screen.findByDisplayValue("Backend Engineer");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("INVITE PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it("falls back to the name when role_title is empty", async () => {
    assessmentsApiMock.get.mockResolvedValue({
      data: { assessment: { ...loadedAssessment, role_title: "" } },
    });
    renderEdit();
    await screen.findByDisplayValue("Backend Engineer");
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("INVITE PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(assessmentsApiMock.update).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ role_title: "Backend Engineer" }),
    );
  });
});
