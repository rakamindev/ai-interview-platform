import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PaginationControls from "@/components/common/PaginationControls";
import type { PaginationMeta } from "@/types";

const meta = (over: Partial<PaginationMeta> = {}): PaginationMeta => ({
  current_page: 1,
  total_pages: 3,
  total_count: 55,
  per_page: 20,
  ...over,
});

describe("PaginationControls", () => {
  it("renders nothing when meta is null", () => {
    const { container } = render(<PaginationControls meta={null} onPageChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there is only one page", () => {
    const { container } = render(
      <PaginationControls meta={meta({ total_pages: 1 })} onPageChange={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows current page, total pages and item count", () => {
    render(<PaginationControls meta={meta({ current_page: 2 })} onPageChange={vi.fn()} />);

    expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
    expect(screen.getByText(/55 items/)).toBeInTheDocument();
  });

  it("disables Previous on the first page", () => {
    render(<PaginationControls meta={meta({ current_page: 1 })} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("disables Next on the last page", () => {
    render(<PaginationControls meta={meta({ current_page: 3 })} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  });

  it("emits the adjacent page number on click", async () => {
    const onPageChange = vi.fn();
    render(<PaginationControls meta={meta({ current_page: 2 })} onPageChange={onPageChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("disables both buttons while loading", () => {
    render(<PaginationControls meta={meta({ current_page: 2 })} onPageChange={vi.fn()} disabled />);

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });
});
