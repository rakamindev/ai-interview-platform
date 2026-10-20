import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PaginationControls from "./PaginationControls";

const meta = { current_page: 2, total_pages: 3, total_count: 60, per_page: 20 };

describe("PaginationControls", () => {
  it("announces the current page and emits boundary navigation", () => {
    const onPageChange = vi.fn();
    render(<PaginationControls meta={meta} onPageChange={onPageChange} />);

    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
  });

  it("does not render controls for a single page", () => {
    render(<PaginationControls meta={{ ...meta, total_pages: 1 }} onPageChange={vi.fn()} />);
    expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
  });
});
