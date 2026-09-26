import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Pagination from "@/components/common/Pagination";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import type { SkillComparison } from "@/types";

describe("Pagination Component", () => {
  it("renders nothing when totalPages is 1 or less", () => {
    const onPageChange = vi.fn();
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={onPageChange} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders correct page numbers and summary count", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        totalCount={48}
        perPage={10}
        onPageChange={onPageChange}
      />
    );

    expect(screen.getByText(/Showing/i)).toBeDefined();
    expect(screen.getByText("11")).toBeDefined();
    expect(screen.getByText("20")).toBeDefined();
    expect(screen.getByText("48")).toBeDefined();
    expect(screen.getByRole("button", { name: "Page 2" })).toBeDefined();
  });

  it("calls onPageChange when page button or next/prev is clicked", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={2}
        totalPages={4}
        onPageChange={onPageChange}
      />
    );

    const prevButton = screen.getByRole("button", { name: "Previous page" });
    fireEvent.click(prevButton);
    expect(onPageChange).toHaveBeenCalledWith(1);

    const nextButton = screen.getByRole("button", { name: "Next page" });
    fireEvent.click(nextButton);
    expect(onPageChange).toHaveBeenCalledWith(3);

    const page3Button = screen.getByRole("button", { name: "Page 3" });
    fireEvent.click(page3Button);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("disables previous button on first page and next button on last page", () => {
    const onPageChange = vi.fn();
    const { rerender } = render(
      <Pagination currentPage={1} totalPages={3} onPageChange={onPageChange} />
    );

    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).not.toBeDisabled();

    rerender(
      <Pagination currentPage={3} totalPages={3} onPageChange={onPageChange} />
    );

    expect(screen.getByRole("button", { name: "Previous page" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });
});

describe("Fit/Gap ComparisonTable Component", () => {
  it("renders empty state message when comparisons array is empty", () => {
    render(<ComparisonTable comparisons={[]} />);
    expect(
      screen.getByText("No required skills are configured for this vacancy.")
    ).toBeDefined();
  });

  it("renders required level properly from required_level or expected_level", () => {
    const comparisons: SkillComparison[] = [
      {
        skill_label: "React",
        required_level: 3,
        candidate_level: 3,
        result: "match",
        delta: 0,
      },
      {
        skill_label: "Ruby on Rails",
        expected_level: 4,
        candidate_level: 2,
        result: "gap",
        delta: -2,
      },
    ];

    render(<ComparisonTable comparisons={comparisons} />);

    expect(screen.getByText("React")).toBeDefined();
    expect(screen.getByText("Ruby on Rails")).toBeDefined();
    expect(screen.getAllByText("L3")).toHaveLength(2);
    expect(screen.getByText("L4")).toBeDefined();
  });
});
