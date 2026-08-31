import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import userEvent from "@testing-library/user-event";

import { assessmentsApi } from "@/services/assessments";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import MOCK_SKILL_TAXONOMIES from "@/testing/__mocks__/skillTaxonomies.mock";
import AssessmentListPage from "../AssessmentListPage";
import AssessmentNewPage from "../AssessmentNewPage";
import AssessmentInvitePage from "../AssessmentInvitePage";
import MOCK_ASSESSMENTS from "../__mocks__/assessments.mock";
import MOCK_ASSESSMENT_POST, {
  MOCK_ASESSMENT_CUSTOM_SKILL_POST,
} from "../__mocks__/assessmentPost.mock";

vi.mock("@/services/skillTaxonomies", () => ({
  skillTaxonomiesApi: {
    list: vi.fn(),
  },
}));

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    list: vi.fn(),
    get: vi.fn(),
    getSessions: vi.fn(),
    create: vi.fn(),
    createSession: vi.fn(),
  },
}));

describe("Assessments Page", () => {
  beforeEach(() => {
    vi.mocked(skillTaxonomiesApi.list).mockResolvedValue({
      data: MOCK_SKILL_TAXONOMIES,
    } as never);
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter initialEntries={["/assessments"]}>
        <Routes>
          <Route path="/assessments" element={<AssessmentListPage />} />
          <Route path="/assessments/new" element={<AssessmentNewPage />} />
          <Route
            path="/assessments/:id/invite"
            element={<AssessmentInvitePage />}
          />
        </Routes>
      </MemoryRouter>,
    );
  };

  it("Crew New Assessment flow", async () => {
    const createdAssessment = { ...MOCK_ASSESSMENT_POST, id: 99 };

    vi.mocked(assessmentsApi.list).mockResolvedValue({
      data: {
        assessments: [MOCK_ASSESSMENTS],
        meta: { total_pages: 1, current_page: 1 },
      },
    } as never);
    vi.mocked(assessmentsApi.create).mockResolvedValue({
      data: { assessment: createdAssessment },
    } as never);
    vi.mocked(assessmentsApi.get).mockResolvedValue({
      data: { assessment: createdAssessment },
    } as never);
    vi.mocked(assessmentsApi.getSessions).mockResolvedValue({
      data: { sessions: [] },
    } as never);

    renderComponent();

    const btnNewAssessment = await screen.findByRole("button", {
      name: /New Assessment/i,
    });
    expect(btnNewAssessment).toBeDefined();

    await userEvent.click(btnNewAssessment);

    const btnSave = await screen.findByRole("button", {
      name: /Save & Create Session/i,
    });
    expect(btnSave).toBeDefined();

    const inputRoleTitle = screen.getByLabelText(/Role title/i);
    await userEvent.type(inputRoleTitle, "Junior Frontend Engineer");
    expect(inputRoleTitle).toHaveValue("Junior Frontend Engineer");

    const btnAddSkill = screen.getByRole("button", {
      name: /Add from Skill Taxonomy/i,
    });
    await userEvent.click(btnAddSkill);

    const skillOption = await screen.findByRole("button", {
      name: /React \/ Frontend Development Core/i,
    });
    await userEvent.click(skillOption);

    const addedSkill = await screen.findByText(
      "React / Frontend Development Core",
    );
    expect(addedSkill).toBeDefined();

    const levelL3 = await screen.findByLabelText("L3");
    expect(levelL3).toBeTruthy();

    expect(screen.getByRole("radio", { name: "L3" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "L1" }));
    expect(screen.getByRole("radio", { name: "L1" })).toBeChecked();

    await userEvent.click(screen.getByText(/Save & Create Session/i));
    expect(assessmentsApi.create).toHaveBeenCalledOnce();
  });

  it("Empty state when there are no assessments", async () => {
    vi.mocked(assessmentsApi.list).mockResolvedValue({
      data: {
        assessments: [],
        meta: { total_pages: 1, current_page: 1 },
      },
    } as never);

    render(
      <MemoryRouter>
        <AssessmentListPage />
      </MemoryRouter>,
    );

    const noAssessmentsText = await screen.findByText(/No assessments yet\./i);
    expect(noAssessmentsText).toBeDefined();

    const btnCreateFirst = screen.getByRole("button", {
      name: /Create your first assessment/i,
    });
    expect(btnCreateFirst).toBeDefined();
  });

  it("Crew New Assessment with Custom skill flow", async () => {
    const createdAssessment = { ...MOCK_ASESSMENT_CUSTOM_SKILL_POST, id: 99 };

    vi.mocked(assessmentsApi.list).mockResolvedValue({
      data: {
        assessments: [MOCK_ASSESSMENTS],
        meta: { total_pages: 1, current_page: 1 },
      },
    } as never);
    vi.mocked(assessmentsApi.create).mockResolvedValue({
      data: { assessment: createdAssessment },
    } as never);
    vi.mocked(assessmentsApi.get).mockResolvedValue({
      data: { assessment: createdAssessment },
    } as never);
    vi.mocked(assessmentsApi.getSessions).mockResolvedValue({
      data: { sessions: [] },
    } as never);

    renderComponent();

    const btnNewAssessment = await screen.findByRole("button", {
      name: /New Assessment/i,
    });
    expect(btnNewAssessment).toBeDefined();

    await userEvent.click(btnNewAssessment);

    const btnSave = await screen.findByRole("button", {
      name: /Save & Create Session/i,
    });
    expect(btnSave).toBeDefined();

    const inputRoleTitle = screen.getByLabelText(/Role title/i);
    await userEvent.type(inputRoleTitle, createdAssessment.assessment.name);
    expect(inputRoleTitle).toHaveValue(createdAssessment.assessment.name);

    const btnAddCustomSkill = screen.getByRole("button", {
      name: /Add custom skill/i,
    });
    await userEvent.click(btnAddCustomSkill);

    const [firstAssessmentSkill] =
      createdAssessment.assessment.assessment_skills_attributes;
    const inputSkillName = await screen.findByLabelText(/name/i);
    await userEvent.type(inputSkillName, firstAssessmentSkill.skill_label);
    const inputScope = await screen.findByLabelText(/scope include/i);
    await userEvent.type(inputScope, firstAssessmentSkill.scope_include);
    const inputL1 = await screen.findByLabelText(/L1 anchor/i);
    await userEvent.type(inputL1, firstAssessmentSkill.l1_anchor);
    const inputL2 = await screen.findByLabelText(/L2 anchor/i);
    await userEvent.type(inputL2, firstAssessmentSkill.l2_anchor);
    const inputL3 = await screen.findByLabelText(/L3 anchor/i);
    await userEvent.type(inputL3, firstAssessmentSkill.l3_anchor);
    const inputL4 = await screen.findByLabelText(/L4 anchor/i);
    await userEvent.type(inputL4, firstAssessmentSkill.l4_anchor);
    const inputL5 = await screen.findByLabelText(/L5 anchor/i);
    await userEvent.type(inputL5, firstAssessmentSkill.l5_anchor);

    const levelL3 = await screen.findByLabelText("L3");
    expect(levelL3).toBeTruthy();

    expect(screen.getByRole("radio", { name: "L3" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "L1" }));
    expect(screen.getByRole("radio", { name: "L1" })).toBeChecked();

    await userEvent.click(screen.getByText(/Save & Create Session/i));
    expect(btnNewAssessment).toBeDefined();
  });

  it.todo("Edit assessment flow");
});
