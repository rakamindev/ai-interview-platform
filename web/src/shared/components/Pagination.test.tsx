import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import Pagination from "./Pagination";

describe("Pagination", () => {
  it("still renders, with both buttons disabled, when there's only one page", () => {
    render(<Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />);
    expect(screen.getByText(/page 1 of 1/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("renders nothing when there are zero pages", () => {
    const { container } = render(<Pagination currentPage={1} totalPages={0} onPageChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the current page and total", () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByText(/page 2 of 5/i)).toBeInTheDocument();
  });

  it("disables Previous on the first page and Next on the last page", () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeEnabled();
  });

  it("calls onPageChange with the next/previous page", async () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={2} totalPages={3} onPageChange={onPageChange} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole("button", { name: /previous/i }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
