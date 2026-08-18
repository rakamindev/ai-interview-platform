import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { useAssessmentListPage } from "./useAssessmentListPage";
import { assessmentsApi } from "@/services/assessments";

vi.mock("@/services/assessments", () => ({
  assessmentsApi: {
    list: vi.fn(),
  },
}));

const mockedList = vi.mocked(assessmentsApi.list);

const createWrapper = () => {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  };
};

describe("useAssessmentListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads assessments successfully", async () => {
    const assessments = [
      {
        id: 1,
        name: "Senior Frontend Engineer",
        time_limit_min: 10,
        latest_session: {
          status: "ended",
          end_reason: null,
        },
      },
      {
        id: 2,
        name: "Senior Backend Engineer",
        time_limit_min: 20,
        latest_session: null,
      },
    ];

    mockedList.mockResolvedValue({
      data: {
        assessments,
      },
    } as never);

    const { result } = renderHook(() => useAssessmentListPage(), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(false);
    expect(result.current.assessments).toEqual(assessments);
    expect(mockedList).toHaveBeenCalledTimes(1);
  });

  it("returns empty assessments when API returns an empty list", async () => {
    mockedList.mockResolvedValue({
      data: {
        assessments: [],
      },
    } as never);

    const { result } = renderHook(() => useAssessmentListPage(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(false);
    expect(result.current.assessments).toEqual([]);
    expect(result.current.assessments).toHaveLength(0);
  });

  it("handles API error without treating it as an empty result", async () => {
    mockedList.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAssessmentListPage(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toBe(true);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.assessments).toEqual([]);
    expect(mockedList).toHaveBeenCalledTimes(1);
  });

  it("retries loading assessments", async () => {
    mockedList
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        data: {
          assessments: [
            {
              id: 1,
              name: "Senior Frontend Engineer",
              time_limit_min: 10,
              latest_session: null,
            },
          ],
        },
      } as never);

    const { result } = renderHook(() => useAssessmentListPage(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toBe(true);
    });

    expect(mockedList).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.getAssessments();
    });

    await waitFor(() => {
      expect(result.current.error).toBe(false);
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.assessments).toHaveLength(1);
    expect(result.current.assessments[0].name).toBe(
      "Senior Frontend Engineer"
    );
    expect(mockedList).toHaveBeenCalledTimes(2);
  });

  it("sets loading state while retrying", async () => {
    let resolveRequest!: (value: unknown) => void;

    mockedList.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useAssessmentListPage(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toBe(true);
    });

    mockedList.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }) as never
    );

    act(() => {
      void result.current.getAssessments();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    expect(result.current.error).toBe(false);

    await act(async () => {
      resolveRequest({
        data: {
          assessments: [],
        },
      });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});