import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import AssessmentEditPage from "./AssessmentEditPage";
import { useAssessmentNewPage } from "@/pages/assessments/useAssessmentNewPage";
import { useAssessmentEditPage } from "@/pages/assessments/useAssessmentEditPage";

const mockedNavigate = vi.fn();

vi.mock("@/pages/assessments/useAssessmentNewPage");
vi.mock("@/pages/assessments/useAssessmentEditPage");

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<
    typeof import("react-router-dom")
  >("react-router-dom");

  return {
    ...actual,
    useNavigate: () => mockedNavigate,
    useParams: () => ({
      id: "123",
    }),
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
      skill_label: string;
      expected_level?: number;
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
              skill_label: "React",
              expected_level: 4,
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

      <button
        type="button"
        onClick={onRemove}
      >
        Remove Skill
      </button>
    </div>
  ),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({
    className,
  }: {
    className?: string;
  }) => (
    <div
      data-testid="skeleton"
      className={className}
    />
  ),
}));

const mockedSetPickerOpen = vi.fn();
const mockedSetValue = vi.fn();
const mockedAddCustomSkill = vi.fn();
const mockedAddB7Skill = vi.fn();
const mockedRemove = vi.fn();
const mockedHandleDragEnd = vi.fn();
const mockedSetError = vi.fn();
const mockedOnSubmit = vi.fn();
const mockedSetDeletedSkills = vi.fn();
const mockedRefetchData = vi.fn();

const mockForm = {
  formState: {
    errors: {},
  },
  register: vi.fn(() => ({})),
  watch: vi.fn((name: string) => {
    if (name === "time_limit_min") {
      return 45;
    }

    return undefined;
  }),
};

const defaultNewPageMock = {
  form: mockForm,
  fields: [],
  sensors: [],
  pickerOpen: false,
  error: null,
  addB7Skill: mockedAddB7Skill,
  setError: mockedSetError,
  addCustomSkill: mockedAddCustomSkill,
  handleSubmit: vi.fn(
    (callback: (data: unknown) => void) =>
      (event?: React.BaseSyntheticEvent) => {
        event?.preventDefault();
        callback({});
      }
  ),
  remove: mockedRemove,
  handleDragEnd: mockedHandleDragEnd,
  setPickerOpen: mockedSetPickerOpen,
  setValue: mockedSetValue,
};

const defaultEditPageMock = {
  loading: false,
  submitting: false,
  fetchError: false,
  refetchData: mockedRefetchData,
  onSubmit: mockedOnSubmit,
  setDeletedSkills: mockedSetDeletedSkills,
};

const renderPage = () => {
  return render(
    <MemoryRouter initialEntries={["/assessments/123/edit"]}>
      <AssessmentEditPage />
    </MemoryRouter>
  );
};

describe("AssessmentEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAssessmentNewPage).mockReturnValue(
      defaultNewPageMock as never
    );

    vi.mocked(useAssessmentEditPage).mockReturnValue(
      defaultEditPageMock as never
    );
  });

  it("shows loading skeleton while assessment is loading", () => {
    vi.mocked(useAssessmentEditPage).mockReturnValue({
      ...defaultEditPageMock,
      loading: true,
    } as never);

    renderPage();

    expect(
      screen.getAllByTestId("skeleton")
    ).toHaveLength(4);

    expect(
      screen.queryByText("Edit Assessment")
    ).not.toBeInTheDocument();
  });

  it("renders fetch error state", () => {
    vi.mocked(useAssessmentEditPage).mockReturnValue({
      ...defaultEditPageMock,
      fetchError: true,
    } as never);

    renderPage();

    expect(
      screen.getByText(
        "We couldn't retrieve the page. Please try again."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /try again/i,
      })
    ).toBeInTheDocument();
  });

  it("calls refetchData when try again is clicked", async () => {
    const user = userEvent.setup();

    vi.mocked(useAssessmentEditPage).mockReturnValue({
      ...defaultEditPageMock,
      fetchError: true,
    } as never);

    renderPage();

    await user.click(
      screen.getByRole("button", {
        name: /try again/i,
      })
    );

    expect(mockedRefetchData).toHaveBeenCalledTimes(1);
  });

  it("renders edit assessment form", () => {
    renderPage();

    expect(
      screen.getByText("Edit Assessment")
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(/role title/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/session time limit/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText("Skills to assess")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /add from b7 taxonomy/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /add custom skill/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /save changes/i,
      })
    ).toBeInTheDocument();
  });

  it("shows empty state when there are no skills", () => {
    renderPage();

    expect(
      screen.getByText("No skills added yet.")
    ).toBeInTheDocument();
  });

  it("renders existing skills", () => {
    vi.mocked(useAssessmentNewPage).mockReturnValue({
      ...defaultNewPageMock,
      fields: [
        {
          id: "skill-1",
        },
        {
          id: "skill-2",
        },
      ],
    } as never);

    renderPage();

    expect(
      screen.getByTestId("skill-card-0")
    ).toBeInTheDocument();

    expect(
      screen.getByTestId("skill-card-1")
    ).toBeInTheDocument();

    expect(
      screen.queryByText("No skills added yet.")
    ).not.toBeInTheDocument();
  });

  it("opens skill picker when adding from B7 taxonomy", async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(
      screen.getByRole("button", {
        name: /add from b7 taxonomy/i,
      })
    );

    expect(
      mockedSetPickerOpen
    ).toHaveBeenCalledWith(true);
  });

  it("adds custom skill when clicking add custom skill", async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(
      screen.getByRole("button", {
        name: /add custom skill/i,
      })
    );

    expect(
      mockedAddCustomSkill
    ).toHaveBeenCalledTimes(1);
  });

  it("renders skill picker when picker is open", () => {
    vi.mocked(useAssessmentNewPage).mockReturnValue({
      ...defaultNewPageMock,
      pickerOpen: true,
    } as never);

    renderPage();

    expect(
      screen.getByTestId("skill-picker")
    ).toBeInTheDocument();
  });

  it("adds skill from skill picker", async () => {
    const user = userEvent.setup();

    vi.mocked(useAssessmentNewPage).mockReturnValue({
      ...defaultNewPageMock,
      pickerOpen: true,
    } as never);

    renderPage();

    await user.click(
      screen.getByRole("button", {
        name: /select react/i,
      })
    );

    expect(
      mockedAddB7Skill
    ).toHaveBeenCalledWith({
      skill_label: "React",
      expected_level: 4,
    });
  });

  it("removes a skill and marks it as deleted", async () => {
    const user = userEvent.setup();

    const existingSkill = {
      id: 10,
      skill_id: 20,
      skill_label: "React",
      is_custom: false,
      expected_level: 4,
      display_order: 0,
    };

    vi.mocked(useAssessmentNewPage).mockReturnValue({
      ...defaultNewPageMock,
      fields: [
        existingSkill,
      ],
    } as never);

    renderPage();

    await user.click(
      screen.getByRole("button", {
        name: /remove skill/i,
      })
    );

    expect(
      mockedSetDeletedSkills
    ).toHaveBeenCalledTimes(1);

    const updater = mockedSetDeletedSkills.mock.calls[0][0];

    const result = updater([]);

    expect(result).toEqual([
      {
        ...existingSkill,
        _destroy: true,
      },
    ]);

    expect(
      mockedRemove
    ).toHaveBeenCalledWith(0);
  });

  it("shows form error for role title", () => {
    vi.mocked(useAssessmentNewPage).mockReturnValue({
      ...defaultNewPageMock,
      form: {
        ...mockForm,
        formState: {
          errors: {
            name: {
              message: "Role title is required.",
            },
          },
        },
      },
    } as never);

    renderPage();

    expect(
      screen.getByText("Role title is required.")
    ).toBeInTheDocument();
  });

  it("shows skills validation error", () => {
    vi.mocked(useAssessmentNewPage).mockReturnValue({
      ...defaultNewPageMock,
      form: {
        ...mockForm,
        formState: {
          errors: {
            skills: {
              message: "At least one skill is required.",
            },
          },
        },
      },
    } as never);

    renderPage();

    expect(
      screen.getByText(
        "At least one skill is required."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText("No skills added yet.")
    ).toHaveClass("text-destructive");
  });

  it("shows API error", () => {
    vi.mocked(useAssessmentNewPage).mockReturnValue({
      ...defaultNewPageMock,
      error:
        "Unable to save assessment. Please try again.",
    } as never);

    renderPage();

    expect(
      screen.getByText(
        "Unable to save assessment. Please try again."
      )
    ).toBeInTheDocument();
  });

  it("disables save button while submitting", () => {
    vi.mocked(useAssessmentEditPage).mockReturnValue({
      ...defaultEditPageMock,
      submitting: true,
    } as never);

    renderPage();

    expect(
      screen.getByRole("button", {
        name: /save changes/i,
      })
    ).toBeDisabled();
  });

  it("submits the form", async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(
      screen.getByRole("button", {
        name: /save changes/i,
      })
    );

    expect(
      mockedOnSubmit
    ).toHaveBeenCalledTimes(1);
  });

  it("navigates to invite page when cancel is clicked", async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(
      screen.getByRole("button", {
        name: /cancel/i,
      })
    );

    expect(
      mockedNavigate
    ).toHaveBeenCalledWith(
      "/assessments/123/invite"
    );
  });
});