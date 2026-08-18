import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import AssessmentNewPage from "./AssessmentNewPage";
import { assessmentsApi } from "@/services/assessments";

const mockedNavigate = vi.fn();
const mockedCreate = vi.mocked(assessmentsApi.create);

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    create: vi.fn(),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );

  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

vi.mock("@/components/assessment/SkillPicker", () => ({
  default: ({
    open,
    onOpenChange,
    onSelect,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (skill: {
      skill_id?: number;
      skill_label: string;
      is_custom?: boolean;
      expected_level?: number;
      scope_include?: string;
      scope_exclude?: string;
      l1_anchor?: string;
      l2_anchor?: string;
      l3_anchor?: string;
      l4_anchor?: string;
      l5_anchor?: string;
    }) => void;
  }) => {
    if (!open) {
      return null;
    }

    return (
      <div data-testid="skill-picker">
        <button
          type="button"
          onClick={() =>
            onSelect({
              skill_id: 1,
              skill_label: "React",
              is_custom: false,
              expected_level: 4,
              scope_include: "React development",
              scope_exclude: "React Native",
              l1_anchor: "Basic React",
              l2_anchor: "Component development",
              l3_anchor: "Advanced React",
              l4_anchor: "React architecture",
              l5_anchor: "React technical leadership",
            })
          }
        >
          Select React
        </button>

        <button
          type="button"
          onClick={() => onOpenChange(false)}
        >
          Close Skill Picker
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/assessment/SkillCard", () => ({
  default: ({
    index,
    onRemove,
  }: {
    index: number;
    onRemove: () => void;
  }) => (
    <div data-testid={`skill-card-${index}`}>
      <span>Skill {index + 1}</span>

      <button type="button" onClick={onRemove}>
        Remove Skill
      </button>
    </div>
  ),
}));

const renderPage = () => {
  return render(
    <MemoryRouter>
      <AssessmentNewPage />
    </MemoryRouter>
  );
};

describe("AssessmentNewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the new assessment form", () => {
    renderPage();

    expect(
      screen.getByText("New Assessment")
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(/role title/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/session time limit/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/interview language/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText("Skills to assess")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /add from skill taxonomy/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /add custom skill/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /save & create session/i,
      })
    ).toBeInTheDocument();
  });

  it("shows empty state when no skills are added", () => {
    renderPage();

    expect(
      screen.getByText("No skills added yet.")
    ).toBeInTheDocument();
  });

  it("opens skill picker when adding from taxonomy", async () => {
    const user = userEvent.setup();

    renderPage();

    expect(
      screen.queryByTestId("skill-picker")
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /add from skill taxonomy/i,
      })
    );

    expect(
      screen.getByTestId("skill-picker")
    ).toBeInTheDocument();
  });

  it("adds a taxonomy skill from the skill picker", async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(
      screen.getByRole("button", {
        name: /add from skill taxonomy/i,
      })
    );

    await user.click(
      screen.getByRole("button", {
        name: /select react/i,
      })
    );

    expect(
      screen.getByTestId("skill-card-0")
    ).toBeInTheDocument();

    expect(
      screen.queryByText("No skills added yet.")
    ).not.toBeInTheDocument();
  });

  it("adds a custom skill", async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(
      screen.getByRole("button", {
        name: /add custom skill/i,
      })
    );

    expect(
      screen.getByTestId("skill-card-0")
    ).toBeInTheDocument();

    expect(
      screen.queryByText("No skills added yet.")
    ).not.toBeInTheDocument();
  });

  it("removes a skill", async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(
      screen.getByRole("button", {
        name: /add from skill taxonomy/i,
      })
    );

    await user.click(
      screen.getByRole("button", {
        name: /select react/i,
      })
    );

    expect(
      screen.getByTestId("skill-card-0")
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /remove skill/i,
      })
    );

    expect(
      screen.queryByTestId("skill-card-0")
    ).not.toBeInTheDocument();

    expect(
      screen.getByText("No skills added yet.")
    ).toBeInTheDocument();
  });

  it("shows validation error when submitting without required fields", async () => {
    const user = userEvent.setup();

    renderPage();

    const submitButton = screen.getByRole("button", {
      name: /save & create session/i,
    });

    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Role title is required.")
      ).toBeInTheDocument();
    });
  });

  it("submits a valid assessment successfully", async () => {
    const user = userEvent.setup();

    mockedCreate.mockResolvedValue({
      data: {
        assessment: {
          id: 123,
        },
      },
    } as never);

    renderPage();

    await user.type(
      screen.getByLabelText(/role title/i),
      "Senior Frontend Engineer"
    );

    await user.click(
      screen.getByRole("button", {
        name: /add from skill taxonomy/i,
      })
    );

    await user.click(
      screen.getByRole("button", {
        name: /select react/i,
      })
    );

    const submitButton = screen.getByRole("button", {
      name: /save & create session/i,
    });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    await user.click(submitButton);

    await waitFor(() => {
      expect(mockedCreate).toHaveBeenCalledTimes(1);
    });

    expect(mockedCreate).toHaveBeenCalledWith({
      name: "Senior Frontend Engineer",
      time_limit_min: 45,
      language: "en",
      assessment_skills_attributes: [
        {
          skill_id: 1,
          skill_label: "React",
          is_custom: false,
          expected_level: 4,
          scope_include: "React development",
          scope_exclude: "React Native",
          l1_anchor: "Basic React",
          l2_anchor: "Component development",
          l3_anchor: "Advanced React",
          l4_anchor: "React architecture",
          l5_anchor: "React technical leadership",
          display_order: 0,
        },
      ],
    });

    expect(mockedNavigate).toHaveBeenCalledWith(
      "/assessments/123/invite"
    );
  });

  it("shows API error when saving assessment fails", async () => {
    const user = userEvent.setup();

    mockedCreate.mockRejectedValue(new Error("Network error"));

    renderPage();

    await user.type(
      screen.getByLabelText(/role title/i),
      "Senior Frontend Engineer"
    );

    await user.click(
      screen.getByRole("button", {
        name: /add from skill taxonomy/i,
      })
    );

    await user.click(
      screen.getByRole("button", {
        name: /select react/i,
      })
    );

    const submitButton = screen.getByRole("button", {
      name: /save & create session/i,
    });

    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });

    await user.click(submitButton);

    expect(
      await screen.findByText(
        "Unable to save assessment. Please try again."
      )
    ).toBeInTheDocument();

    expect(mockedNavigate).not.toHaveBeenCalled();
  });

  it("disables submit button while saving", async () => {
    const user = userEvent.setup();

    let resolveCreate!: (value: unknown) => void;

    mockedCreate.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }) as never
    );

    renderPage();

    await user.type(
      screen.getByLabelText(/role title/i),
      "Senior Frontend Engineer"
    );

    await user.click(
      screen.getByRole("button", {
        name: /add from skill taxonomy/i,
      })
    );

    await user.click(
      screen.getByRole("button", {
        name: /select react/i,
      })
    );

    const submitButton = screen.getByRole("button", {
      name: /save & create session/i,
    });

    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });

    await user.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });

    resolveCreate({
      data: {
        assessment: {
          id: 123,
        },
      },
    });

    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith(
        "/assessments/123/invite"
      );
    });
  });

  it("navigates to assessments when cancel is clicked", async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(
      screen.getByRole("button", {
        name: /cancel/i,
      })
    );

    expect(mockedNavigate).toHaveBeenCalledWith(
      "/assessments"
    );
  });
});