import React from "react";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderHook,
  act,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAssessmentEditPage } from "./useAssessmentEditPage";
import { assessmentsApi } from "@/services/assessments";
import { assessmentSchema } from "@/pages/assessments/assessmentSchema";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    get: vi.fn(),
    update: vi.fn(),
  },
}));

const mockedGet = vi.mocked(assessmentsApi.get);
const mockedUpdate = vi.mocked(assessmentsApi.update);
const mockedNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<
    typeof import("react-router-dom")
  >("react-router-dom");

  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

type FormValues = z.infer<typeof assessmentSchema>;

const defaultValues: FormValues = {
  name: "",
  time_limit_min: 45,
  language: "en",
  skills: [],
};

const createWrapper = () => {
  return function Wrapper({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return <MemoryRouter>{children}</MemoryRouter>;
  };
};

const renderEditHook = (id?: string) => {
  const setError = vi.fn();

  const { result } = renderHook(
    () => {
      const form = useForm<FormValues>({
        defaultValues,
      });

      const edit = useAssessmentEditPage({
        id,
        form,
        setError,
      });

      return {
        edit,
        form,
      };
    },
    {
      wrapper: createWrapper(),
    }
  );

  return {
    result,
    setError,
  };
};

/**
 * API response:
 * skill_id = taxonomy skill ID
 *
 * Form:
 * id = skill_id
 */
const existingSkill = {
  id: 1,
  skill_id: 10,
  skill_label: "React",
  is_custom: false,
  expected_level: 4,
  display_order: 0,
  scope_include: "React development",
  scope_exclude: "React Native",
  l1_anchor: "Basic React",
  l2_anchor: "Components",
  l3_anchor: "Advanced React",
  l4_anchor: "Architecture",
  l5_anchor: "Leadership",
};

describe("useAssessmentEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with loading state", () => {
    mockedGet.mockReturnValue(
      new Promise(() => { }) as never
    );

    const { result } = renderEditHook("123");

    expect(result.current.edit.loading).toBe(true);
    expect(result.current.edit.submitting).toBe(false);
    expect(result.current.edit.fetchError).toBe(false);
  });

  it("fetches assessment and resets form with response data", async () => {
    mockedGet.mockResolvedValue({
      data: {
        assessment: {
          id: 123,
          name: "Frontend Engineer",
          time_limit_min: 60,
          language: "en",
          skills: [existingSkill],
        },
      },
    } as never);

    const { result } = renderEditHook("123");

    await waitFor(() => {
      expect(result.current.edit.loading).toBe(false);
    });

    expect(mockedGet).toHaveBeenCalledWith(123);

    expect(result.current.form.getValues()).toEqual({
      name: "Frontend Engineer",
      time_limit_min: 60,
      language: "en",
      skills: [
        {
          id: 1,
          skill_id: 1,
          skill_label: "React",
          is_custom: false,
          expected_level: 4,
          display_order: 0,
          scope_include: "React development",
          scope_exclude: "React Native",
          l1_anchor: "Basic React",
          l2_anchor: "Components",
          l3_anchor: "Advanced React",
          l4_anchor: "Architecture",
          l5_anchor: "Leadership",
        },
      ],
    });

    expect(result.current.edit.fetchError).toBe(false);
  });

  it("stops loading when fetching assessment fails", async () => {
    mockedGet.mockRejectedValue(
      new Error("Network error")
    );

    const { result } = renderEditHook("123");

    await waitFor(() => {
      expect(result.current.edit.loading).toBe(false);
    });

    expect(result.current.edit.fetchError).toBe(true);
  });

  it("updates assessment with the correct payload", async () => {
    mockedGet.mockResolvedValue({
      data: {
        assessment: {
          id: 123,
          name: "Frontend Engineer",
          time_limit_min: 45,
          language: "en",
          skills: [],
        },
      },
    } as never);

    mockedUpdate.mockResolvedValue({
      data: {
        assessment: {
          id: 123,
        },
      },
    } as never);

    const { result } = renderEditHook("123");

    await waitFor(() => {
      expect(result.current.edit.loading).toBe(false);
    });

    const data: FormValues = {
      name: "Senior Frontend Engineer",
      time_limit_min: 60,
      language: "en",
      skills: [
        {
          id: 10,
          skill_label: "React",
          is_custom: false,
          expected_level: 4,
          display_order: 0,
          scope_include: "React development",
          scope_exclude: "React Native",
          l1_anchor: "Basic React",
          l2_anchor: "Components",
          l3_anchor: "Advanced React",
          l4_anchor: "Architecture",
          l5_anchor: "Leadership",
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
    };

    await act(async () => {
      await result.current.edit.onSubmit(data);
    });

    expect(mockedUpdate).toHaveBeenCalledTimes(1);

    expect(mockedUpdate).toHaveBeenCalledWith(123, {
      name: "Senior Frontend Engineer",
      time_limit_min: 60,
      assessment_skills_attributes: [
        {
          id: 10,
          skill_label: "React",
          is_custom: false,
          expected_level: 4,
          display_order: 0,
          scope_include: "React development",
          scope_exclude: "React Native",
          l1_anchor: "Basic React",
          l2_anchor: "Components",
          l3_anchor: "Advanced React",
          l4_anchor: "Architecture",
          l5_anchor: "Leadership",
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

    expect(result.current.edit.submitting).toBe(false);
  });

  it("includes deleted skills with _destroy", async () => {
    mockedGet.mockResolvedValue({
      data: {
        assessment: {
          id: 123,
          name: "Frontend Engineer",
          time_limit_min: 45,
          language: "en",
          skills: [],
        },
      },
    } as never);

    mockedUpdate.mockResolvedValue({
      data: {
        assessment: {
          id: 123,
        },
      },
    } as never);

    const { result } = renderEditHook("123");

    await waitFor(() => {
      expect(result.current.edit.loading).toBe(false);
    });

    act(() => {
      result.current.edit.setDeletedSkills([
        {
          id: 10,
          skill_label: "React",
          is_custom: false,
          expected_level: 4,
          display_order: 0,
          scope_include: "React development",
          scope_exclude: "React Native",
          l1_anchor: "Basic React",
          l2_anchor: "Components",
          l3_anchor: "Advanced React",
          l4_anchor: "Architecture",
          l5_anchor: "Leadership",
          _destroy: true,
        },
      ] as never);
    });

    await act(async () => {
      await result.current.edit.onSubmit({
        name: "Frontend Engineer",
        time_limit_min: 45,
        language: "en",
        skills: [],
      });
    });

    expect(mockedUpdate).toHaveBeenCalledTimes(1);

    const [, payload] = mockedUpdate.mock.calls[0];

    expect(payload.assessment_skills_attributes).toEqual([
      {
        id: 10,
        skill_label: "React",
        is_custom: false,
        expected_level: 4,
        display_order: 0,
        scope_include: "React development",
        scope_exclude: "React Native",
        l1_anchor: "Basic React",
        l2_anchor: "Components",
        l3_anchor: "Advanced React",
        l4_anchor: "Architecture",
        l5_anchor: "Leadership",
        _destroy: true,
      },
    ]);
  });

  it("sets submitting to true while updating", async () => {
    mockedGet.mockResolvedValue({
      data: {
        assessment: {
          id: 123,
          name: "Frontend Engineer",
          time_limit_min: 45,
          language: "en",
          skills: [],
        },
      },
    } as never);

    let resolveUpdate!: (value: unknown) => void;

    mockedUpdate.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }) as never
    );

    const { result } = renderEditHook("123");

    await waitFor(() => {
      expect(result.current.edit.loading).toBe(false);
    });

    let submitPromise!: Promise<void>;

    act(() => {
      submitPromise = result.current.edit.onSubmit({
        name: "Frontend Engineer",
        time_limit_min: 45,
        language: "en",
        skills: [],
      });
    });

    await waitFor(() => {
      expect(result.current.edit.submitting).toBe(true);
    });

    resolveUpdate({
      data: {
        assessment: {
          id: 123,
        },
      },
    });

    await act(async () => {
      await submitPromise;
    });

    expect(result.current.edit.submitting).toBe(false);
  });

  it("handles Axios API error", async () => {
    mockedGet.mockResolvedValue({
      data: {
        assessment: {
          id: 123,
          name: "Frontend Engineer",
          time_limit_min: 45,
          language: "en",
          skills: [],
        },
      },
    } as never);

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
            message: "Failed to update assessment.",
          },
        ],
      },
    };

    mockedUpdate.mockRejectedValue(error);

    const { result, setError } = renderEditHook("123");

    await waitFor(() => {
      expect(result.current.edit.loading).toBe(false);
    });

    await act(async () => {
      await result.current.edit.onSubmit({
        name: "Backend Engineer",
        time_limit_min: 45,
        language: "en",
        skills: [],
      });
    });

    expect(setError).toHaveBeenCalledWith(
      "Failed to update assessment."
    );

    expect(result.current.edit.submitting).toBe(false);
    expect(mockedNavigate).not.toHaveBeenCalled();
  });

  it("handles Axios error without error message", async () => {
    mockedGet.mockResolvedValue({
      data: {
        assessment: {
          id: 123,
          name: "Frontend Engineer",
          time_limit_min: 45,
          language: "en",
          skills: [],
        },
      },
    } as never);

    const error = new axios.AxiosError(
      "Request failed",
      "ERR_BAD_REQUEST"
    );

    error.response = {
      status: 422,
      statusText: "Unprocessable Entity",
      headers: {},
      config: {} as never,
      data: {},
    };

    mockedUpdate.mockRejectedValue(error);

    const { result, setError } = renderEditHook("123");

    await waitFor(() => {
      expect(result.current.edit.loading).toBe(false);
    });

    await act(async () => {
      await result.current.edit.onSubmit({
        name: "Backend Engineer",
        time_limit_min: 45,
        language: "en",
        skills: [],
      });
    });

    expect(setError).toHaveBeenCalledWith(
      "Unable to save assessment. Please try again."
    );

    expect(result.current.edit.submitting).toBe(false);
  });

  it("handles generic error", async () => {
    mockedGet.mockResolvedValue({
      data: {
        assessment: {
          id: 123,
          name: "Frontend Engineer",
          time_limit_min: 45,
          language: "en",
          skills: [],
        },
      },
    } as never);

    mockedUpdate.mockRejectedValue(
      new Error("Something went wrong")
    );

    const { result, setError } = renderEditHook("123");

    await waitFor(() => {
      expect(result.current.edit.loading).toBe(false);
    });

    await act(async () => {
      await result.current.edit.onSubmit({
        name: "Backend Engineer",
        time_limit_min: 45,
        language: "en",
        skills: [],
      });
    });

    expect(setError).toHaveBeenCalledWith(
      "Unable to save assessment. Please try again."
    );

    expect(result.current.edit.submitting).toBe(false);
    expect(mockedNavigate).not.toHaveBeenCalled();
  });

  it("does not submit when id is undefined", async () => {
    const setError = vi.fn();

    const { result } = renderHook(
      () => {
        const form = useForm<FormValues>({
          defaultValues,
        });

        const editPage = useAssessmentEditPage({
          id: undefined,
          form,
          setError,
        });

        return {
          ...editPage,
          form,
        };
      },
      {
        wrapper: createWrapper(),
      }
    );

    await act(async () => {
      await result.current.onSubmit({
        name: "Backend Engineer",
        time_limit_min: 45,
        language: "en",
        skills: [],
      });
    });

    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(mockedNavigate).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
    expect(result.current.submitting).toBe(false);
  });
});