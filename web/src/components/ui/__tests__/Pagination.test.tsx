import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Pagination } from "../pagination";

describe("Pagination Component (PAGE-01)", () => {
  it("renders nothing when totalPages is 1 or less", () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders page buttons and triggers onPageChange", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination currentPage={1} totalPages={3} onPageChange={onPageChange} />
    );

    expect(screen.getByRole("button", { name: /Page 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Page 2/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Page 3/i })).toBeInTheDocument();

    const prevButton = screen.getByRole("button", { name: /Previous page/i });
    const nextButton = screen.getByRole("button", { name: /Next page/i });

    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Page 2/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);

    fireEvent.click(nextButton);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
