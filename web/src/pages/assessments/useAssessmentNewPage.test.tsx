import React from "react";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { useAssessmentNewPage } from "./useAssessmentNewPage";
import { assessmentsApi } from "@/services/assessments";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    create: vi.fn(),
  },
}));

const mockedCreate = vi.mocked(assessmentsApi.create);

const mockedNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );

  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

const createWrapper = () => {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter>{children}</MemoryRouter>;
  };
};

describe("useAssessmentNewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with default form values", () => {
    const { result } = renderHook(() => useAssessmentNewPage(), {
      wrapper: createWrapper(),
    });

    expect(result.current.form.getValues()).toEqual({
      name: "",
      time_limit_min: 45,
      language: "en",
      skills: [],
    });

    expect(result.current.fields).toHaveLength(0);
    expect(result.current.submitting).toBe(false);
    expect(result.current.pickerOpen).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("adds a custom skill with default values", () => {
    const { result } = renderHook(() => useAssessmentNewPage(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.addCustomSkill();
    });

    expect(result.current.fields).toHaveLength(1);

    const skill = result.current.form.getValues("skills")[0];

    expect(skill).toMatchObject({
      skill_label: "",
      is_custom: true,
      expected_level: 3,
      display_order: 0,
    });
  });

  it("adds a B7 taxonomy skill with default values", () => {
    const { result } = renderHook(() => useAssessmentNewPage(), {
      wrapper: createWrapper(),
    });

    const skill = {
      skill_label: "React",
      taxonomy_id: 123,
    };

    act(() => {
      result.current.addB7Skill(skill);
    });

    expect(result.current.fields).toHaveLength(1);

    const addedSkill = result.current.form.getValues("skills")[0];

    expect(addedSkill).toMatchObject({
      skill_label: "React",
      taxonomy_id: 123,
      is_custom: false,
      expected_level: 3,
      display_order: 0,
    });
  });

  it("reorders skills when drag ends over another skill", () => {
    const { result } = renderHook(() => useAssessmentNewPage(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.addB7Skill({
        skill_label: "React",
      });

      result.current.addB7Skill({
        skill_label: "TypeScript",
      });

      result.current.addB7Skill({
        skill_label: "Next.js",
      });
    });

    const fields = result.current.fields;

    act(() => {
      result.current.handleDragEnd({
        active: {
          id: fields[2].id,
        },
        over: {
          id: fields[0].id,
        },
      } as never);
    });

    const skills = result.current.form.getValues("skills");

    expect(skills.map((skill) => skill.skill_label)).toEqual([
      "Next.js",
      "React",
      "TypeScript",
    ]);
  });

  it("does not reorder skills when dropped on the same skill", () => {
    const { result } = renderHook(() => useAssessmentNewPage(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.addB7Skill({
        skill_label: "React",
      });

      result.current.addB7Skill({
        skill_label: "TypeScript",
      });
    });

    const fields = result.current.fields;

    act(() => {
      result.current.handleDragEnd({
        active: {
          id: fields[0].id,
        },
        over: {
          id: fields[0].id,
        },
      } as never);
    });

    const skills = result.current.form.getValues("skills");

    expect(skills.map((skill) => skill.skill_label)).toEqual([
      "React",
      "TypeScript",
    ]);
  });

  it("submits assessment with the correct payload and navigates to invite page", async () => {
    mockedCreate.mockResolvedValue({
      data: {
        assessment: {
          id: 123,
        },
      },
    } as never);

    const { result } = renderHook(() => useAssessmentNewPage(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.addB7Skill({
        skill_label: "React",
        expected_level: 4,
      });

      result.current.addCustomSkill();

      result.current.form.setValue(
        "skills.1.skill_label",
        "Communication"
      );

      result.current.form.setValue(
        "name",
        "Senior Frontend Engineer"
      );

      result.current.form.setValue("time_limit_min", 45);
      result.current.form.setValue("language", "en");
    });

    await act(async () => {
      await result.current.onSubmit(result.current.form.getValues());
    });

    expect(mockedCreate).toHaveBeenCalledTimes(1);

    expect(mockedCreate).toHaveBeenCalledWith({
      name: "Senior Frontend Engineer",
      time_limit_min: 45,
      language: "en",
      assessment_skills_attributes: [
        {
          skill_label: "React",
          expected_level: 4,
          is_custom: false,
          display_order: 0,
          scope_include: "",
          scope_exclude: "",
          l1_anchor: "",
          l2_anchor: "",
          l3_anchor: "",
          l4_anchor: "",
          l5_anchor: "",
        },
        {
          skill_label: "Communication",
          is_custom: true,
          expected_level: 3,
          display_order: 1,
          scope_include: "",
          scope_exclude: "",
          l1_anchor: "",
          l2_anchor: "",
          l3_anchor: "",
          l4_anchor: "",
          l5_anchor: "",
        },
      ],
    });

    expect(mockedNavigate).toHaveBeenCalledWith(
      "/assessments/123/invite"
    );

    expect(result.current.submitting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("handles API error when saving assessment", async () => {
    const error = new axios.AxiosError(
      "Request failed",
      "ERR_BAD_REQUEST"
    );

    error.response = {
      status: 422,
      statusText: "Unprocessable Entity",
      headers: {},
      config: {} as never,
      data: {
        errors: [
          {
            message: "Failed to save assessment.",
          },
        ],
      },
    };

    mockedCreate.mockRejectedValue(error);

    const { result } = renderHook(() => useAssessmentNewPage(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.onSubmit({
        name: "Senior Frontend Engineer",
        time_limit_min: 45,
        language: "en",
        skills: [],
      });
    });

    expect(result.current.error).toBe(
      "Failed to save assessment."
    );

    expect(result.current.submitting).toBe(false);
    expect(mockedNavigate).not.toHaveBeenCalled();
  });
});