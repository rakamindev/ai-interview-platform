import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { usePagination } from "@/hooks/usePagination";

function wrapper(initialEntry = "/assessments") {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
  );
}

describe("usePagination", () => {
  it("defaults to page 1 when no ?page param exists", () => {
    const { result } = renderHook(() => usePagination(), { wrapper: wrapper() });
    expect(result.current.page).toBe(1);
  });

  it("reads the current page from the URL (?page=2)", () => {
    const { result } = renderHook(() => usePagination(), {
      wrapper: wrapper("/assessments?page=2"),
    });
    expect(result.current.page).toBe(2);
  });

  it.each(["abc", "0", "-3", "NaN"])('falls back to page 1 for invalid value "%s"', (bad) => {
    const { result } = renderHook(() => usePagination(), {
      wrapper: wrapper(`/assessments?page=${bad}`),
    });
    expect(result.current.page).toBe(1);
  });

  it("setPage writes the page into the URL", () => {
    const { result } = renderHook(() => usePagination(), { wrapper: wrapper() });

    act(() => result.current.setPage(3));

    expect(result.current.page).toBe(3);
  });

  it("setPage(1) removes the query param (clean URL)", () => {
    const { result } = renderHook(() => usePagination(), {
      wrapper: wrapper("/assessments?page=4"),
    });

    act(() => result.current.setPage(1));

    expect(result.current.page).toBe(1);
  });
});
