import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PortfolioPage from "./PortfolioPage";
import { usePortfolioPage } from "./usePortfolioPage";

vi.mock("./usePortfolioPage", () => ({
  usePortfolioPage: vi.fn(),
}));

vi.mock("@/components/portfolio/SkillPortfolioCard", () => ({
  default: ({
    skill,
    onOverrideSaved,
  }: {
    skill: {
      id: number;
      skill_label: string;
      ai_level: string;
      ai_confidence: string;
      is_discovered: boolean;
    };
    onOverrideSaved: (override: unknown) => void;
  }) => (
    <div data-testid={`skill-card-${skill.id}`}>
      <span>{skill.skill_label}</span>
      <span>{skill.ai_level}</span>
      <span>{skill.ai_confidence}</span>
      <span>
        {skill.is_discovered ? "discovered" : "configured"}
      </span>

      <button
        onClick={() =>
          onOverrideSaved({
            id: 99,
            portfolio_skill_id: skill.id,
          })
        }
      >
        Save override
      </button>
    </div>
  ),
}));

const mockedUsePortfolioPage = vi.mocked(usePortfolioPage);

type ViewModel = ReturnType<typeof usePortfolioPage>;
type Portfolio = NonNullable<ViewModel["portfolio"]>;
type Skill = Portfolio["skills"][number];

const createSkill = (
  overrides: Partial<Skill> = {}
): Skill => ({
  id: 1,
  skill_label: "React",
  is_discovered: false,
  ai_level: "L4",
  ai_confidence: "high",
  evidence: ["Built React applications."],
  competency_summary: "Strong React experience.",
  ...overrides,
});

const createPortfolio = (
  skills: Portfolio["skills"] = [createSkill()]
): Portfolio => ({
  id: 1,
  session_id: 10,
  generation_status: "complete",
  skills,
  overrides: [],
});

const createViewModel = (
  overrides: Partial<ViewModel> = {}
): ViewModel => ({
  id: "assessment-1",
  sessionId: "10",
  portfolio: null,
  generating: false,
  loading: false,
  overrides: {},
  vacancies: [],
  selectedVacancy: "",
  exporting: null,
  candidateName: null,
  setSelectedVacancy: vi.fn(),
  handleOverrideSaved: vi.fn(),
  handleRunFitGap: vi.fn(),
  handleExport: vi.fn(),
  handleRegenerate: vi.fn(),
  fetchError: false,
  refetchData: vi.fn(),
  exportError: null,
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <PortfolioPage />
    </MemoryRouter>
  );

describe("PortfolioPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        loading: true,
      })
    );

    renderPage();

    expect(
      screen.queryByText("Portfolio Results")
    ).not.toBeInTheDocument();
  });

  it("renders fetch error state", () => {
    const refetchData = vi.fn();

    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        fetchError: true,
        refetchData,
      })
    );

    renderPage();

    expect(
      screen.getByText(
        "We couldn't retrieve the page. Please try again."
      )
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Try Again",
      })
    );

    expect(refetchData).toHaveBeenCalledTimes(1);
  });

  it("renders portfolio header", () => {
    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        portfolio: createPortfolio(),
        candidateName: "John Doe",
      })
    );

    renderPage();

    expect(
      screen.getByRole("heading", {
        name: "Portfolio Results",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText("John Doe")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: /Transcript/i,
      })
    ).toBeInTheDocument();
  });

  it("renders transcript link", () => {
    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        portfolio: createPortfolio(),
      })
    );

    renderPage();

    const link = screen.getByRole("link", {
      name: /Transcript/i,
    });

    expect(link).toHaveAttribute(
      "href",
      "/assessments/assessment-1/sessions/10/transcript"
    );
  });

  it("renders export buttons when portfolio is ready", () => {
    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        portfolio: createPortfolio(),
        generating: false,
      })
    );

    renderPage();

    expect(
      screen.getByRole("button", {
        name: /PDF/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /JSON/i,
      })
    ).toBeInTheDocument();
  });

  it("does not render export buttons while generating", () => {
    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        portfolio: createPortfolio(),
        generating: true,
      })
    );

    renderPage();

    expect(
      screen.queryByRole("button", {
        name: /PDF/i,
      })
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: /JSON/i,
      })
    ).not.toBeInTheDocument();
  });

  it("renders generating state", () => {
    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        generating: true,
      })
    );

    renderPage();

    expect(
      screen.getByText("Generating portfolio...")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "The AI is analyzing the interview transcript. This takes about 2 minutes."
      )
    ).toBeInTheDocument();
  });

  it("renders failed generation state", () => {
    const handleRegenerate = vi.fn();

    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        portfolio: {
          ...createPortfolio(),
          generation_status: "failed",
        },
        generating: false,
        handleRegenerate,
      })
    );

    renderPage();

    expect(
      screen.getByText("Portfolio generation failed.")
    ).toBeInTheDocument();

    const retryButton = screen.getByRole("button", {
      name: /Retry/i,
    });

    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);

    expect(handleRegenerate).toHaveBeenCalledTimes(1);
  });

  it("renders configured skills", () => {
    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        portfolio: createPortfolio([
          createSkill({
            id: 1,
            skill_label: "React",
            is_discovered: false,
          }),
          createSkill({
            id: 2,
            skill_label: "TypeScript",
            is_discovered: false,
            ai_level: "L5",
          }),
        ]),
      })
    );

    renderPage();

    expect(
      screen.getByText("Configured Skills")
    ).toBeInTheDocument();

    expect(
      screen.getByTestId("skill-card-1")
    ).toBeInTheDocument();

    expect(
      screen.getByTestId("skill-card-2")
    ).toBeInTheDocument();

    expect(
      screen.getByText("React")
    ).toBeInTheDocument();

    expect(
      screen.getByText("TypeScript")
    ).toBeInTheDocument();
  });

  it("renders only configured skills in configured skills section", () => {
    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        portfolio: createPortfolio([
          createSkill({
            id: 1,
            skill_label: "React",
            is_discovered: false,
          }),
          createSkill({
            id: 2,
            skill_label: "GraphQL",
            is_discovered: true,
          }),
        ]),
      })
    );

    renderPage();

    const configuredSkills = screen.getByText("Configured Skills")
      .parentElement
      ?.parentElement;

    expect(configuredSkills).toBeInTheDocument();

    expect(
      screen.getByTestId("skill-card-1")
    ).toBeInTheDocument();

    expect(
      screen.getByTestId("skill-card-2")
    ).toBeInTheDocument();

    expect(
      screen.getByText("React")
    ).toBeInTheDocument();

    expect(
      screen.getByText("GraphQL")
    ).toBeInTheDocument();
  });

  it("renders discovered skills section", () => {
    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        portfolio: createPortfolio([
          createSkill({
            id: 1,
            skill_label: "React",
            is_discovered: false,
          }),
          createSkill({
            id: 2,
            skill_label: "GraphQL",
            is_discovered: true,
          }),
        ]),
      })
    );

    renderPage();

    expect(
      screen.getByText("Discovered Skills")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Skills the AI probed that were not in the original assessment"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByTestId("skill-card-2")
    ).toBeInTheDocument();

    expect(
      screen.getByText("GraphQL")
    ).toBeInTheDocument();
  });

  it("does not render discovered skills section when there are no discovered skills", () => {
    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        portfolio: createPortfolio([
          createSkill({
            id: 1,
            skill_label: "React",
            is_discovered: false,
          }),
        ]),
      })
    );

    renderPage();

    expect(
      screen.queryByText("Discovered Skills")
    ).not.toBeInTheDocument();
  });

  it("calls handleOverrideSaved when skill override is saved", () => {
    const handleOverrideSaved = vi.fn();

    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        portfolio: createPortfolio([
          createSkill({
            id: 1,
            skill_label: "React",
          }),
        ]),
        handleOverrideSaved,
      })
    );

    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Save override",
      })
    );

    expect(handleOverrideSaved).toHaveBeenCalledWith(
      1,
      {
        id: 99,
        portfolio_skill_id: 1,
      }
    );
  });

  it("calls handleExport with pdf", () => {
    const handleExport = vi.fn();

    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        portfolio: createPortfolio(),
        handleExport,
      })
    );

    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: /PDF/i,
      })
    );

    expect(handleExport).toHaveBeenCalledWith("pdf");
  });

  it("calls handleExport with json", () => {
    const handleExport = vi.fn();

    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        portfolio: createPortfolio(),
        handleExport,
      })
    );

    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: /JSON/i,
      })
    );

    expect(handleExport).toHaveBeenCalledWith("json");
  });

  it("disables export buttons while exporting", () => {
    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        portfolio: createPortfolio(),
        exporting: "pdf",
      })
    );

    renderPage();

    expect(
      screen.getByRole("button", {
        name: /PDF/i,
      })
    ).toBeDisabled();

    expect(
      screen.getByRole("button", {
        name: /JSON/i,
      })
    ).toBeDisabled();
  });

  it("renders export error", () => {
    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        portfolio: createPortfolio(),
        exportError: "Failed to export portfolio. Please try again.",
      })
    );

    renderPage();

    expect(
      screen.getByText(
        "Failed to export portfolio. Please try again."
      )
    ).toBeInTheDocument();
  });

  it("renders vacancies", () => {
    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        portfolio: createPortfolio(),
        vacancies: [
          {
            id: 1,
            role_title: "Senior Frontend Engineer",
            culture_dimensions: "",
            competency_expectations: "",
            skills: [],
          },
          {
            id: 2,
            role_title: "Frontend Engineer",
            culture_dimensions: "",
            competency_expectations: "",
            skills: [],
          },
        ],
      })
    );

    renderPage();

    fireEvent.click(screen.getByRole("combobox"));

    expect(
      screen.getByRole("option", {
        name: "Senior Frontend Engineer",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("option", {
        name: "Frontend Engineer",
      })
    ).toBeInTheDocument();
  });

  it("calls setSelectedVacancy when vacancy changes", () => {
    const setSelectedVacancy = vi.fn();

    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        portfolio: createPortfolio(),
        vacancies: [
          {
            id: 1,
            role_title: "Senior Frontend Engineer",
            culture_dimensions: "",
            competency_expectations: "",
            skills: [],
          },
        ],
        setSelectedVacancy,
      })
    );

    renderPage();

    fireEvent.click(
      screen.getByRole("combobox")
    );

    fireEvent.click(
      screen.getByText("Senior Frontend Engineer")
    );

    expect(setSelectedVacancy).toHaveBeenCalledWith("1");
  });

  it("disables fit gap button when vacancy is not selected", () => {
    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        portfolio: createPortfolio(),
        selectedVacancy: "",
        vacancies: [],
      })
    );

    renderPage();

    expect(
      screen.getByRole("button", {
        name: /Run Fit\/Gap Analysis/i,
      })
    ).toBeDisabled();
  });

  it("enables fit gap button when vacancy is selected", () => {
    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        portfolio: createPortfolio(),
        selectedVacancy: "1",
        vacancies: [
          {
            id: 1,
            role_title: "Senior Frontend Engineer",
            culture_dimensions: "",
            competency_expectations: "",
            skills: [],
          },
        ],
      })
    );

    renderPage();

    expect(
      screen.getByRole("button", {
        name: /Run Fit\/Gap Analysis/i,
      })
    ).not.toBeDisabled();
  });

  it("calls handleRunFitGap", () => {
    const handleRunFitGap = vi.fn();

    mockedUsePortfolioPage.mockReturnValue(
      createViewModel({
        portfolio: createPortfolio(),
        selectedVacancy: "1",
        handleRunFitGap,
      })
    );

    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Run Fit\/Gap Analysis/i,
      })
    );

    expect(handleRunFitGap).toHaveBeenCalledTimes(1);
  });
});