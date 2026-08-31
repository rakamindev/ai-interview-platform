import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";

import { assessmentsApi } from "@/services/assessments";
import AssessmentInvitePage from "../AssessmentInvitePage";
import MOCK_ASSESSMENT_POST from "../__mocks__/assessmentPost.mock";
import MOCK_SESSIONS from "../__mocks__/sessions.mock";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    list: vi.fn(),
    get: vi.fn(),
    getSessions: vi.fn(),
    create: vi.fn(),
    createSession: vi.fn(),
  },
}));

describe("AssesmentInvitePage", () => {
  it("Empty state when there are no invited candidates", async () => {
    const createdAssessment = { ...MOCK_ASSESSMENT_POST, id: 1 };
    vi.mocked(assessmentsApi.get).mockResolvedValue({
      data: { assessment: createdAssessment },
    } as never);
    vi.mocked(assessmentsApi.getSessions).mockResolvedValue({
      data: { sessions: [] },
    } as never);

    render(
      <MemoryRouter initialEntries={["/assessments/1/invite"]}>
        <AssessmentInvitePage />
      </MemoryRouter>,
    );

    const emptyState = await screen.findByText(/No candidates yet/i);
    expect(emptyState).toBeDefined();
  });

  it("invite candidates", async () => {
    const createdAssessment = { ...MOCK_ASSESSMENT_POST, id: 1 };
    vi.mocked(assessmentsApi.get).mockResolvedValue({
      data: { assessment: createdAssessment },
    } as never);
    vi.mocked(assessmentsApi.getSessions).mockResolvedValue({
      data: {
        sessions: MOCK_SESSIONS,
      },
    } as never);
    vi.mocked(assessmentsApi.createSession).mockResolvedValue({
      data: { session: {} },
    } as never);

    render(
      <MemoryRouter initialEntries={["/assessments/1/invite"]}>
        <AssessmentInvitePage />
      </MemoryRouter>,
    );

    const btnInvite = await screen.findByRole("button", {
      name: /Invite Candidate/i,
    });
    expect(btnInvite).toBeDefined();

    await userEvent.click(btnInvite);
    const inputCandidate = await screen.findByLabelText(/candidate name/i);
    await userEvent.type(inputCandidate, "John Doe");
    expect(inputCandidate).toHaveValue("John Doe");

    await userEvent.click(screen.getByRole("button", { name: "Create Link" }));
    expect(await screen.findAllByText(/Awaiting candidate/i)).toHaveLength(
      MOCK_SESSIONS.filter(({ status }) => status === "pending").length,
    );
  });
});
