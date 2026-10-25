import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Pagination } from "@/components/ui/pagination";

describe("Pagination", () => {
  it("announces page and record context and moves between pages", async () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={2}
        totalPages={4}
        totalCount={72}
        pageSize={20}
        onPageChange={onPageChange}
        ariaLabel="Assessment list pagination"
      />
    );

    expect(screen.getByRole("navigation", { name: /assessment list pagination/i })).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 4")).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) => element?.tagName === "P" && element.textContent === "Showing 21–40 of 72 records"
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /current page, page 2/i })).toHaveAttribute(
      "aria-current",
      "page"
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /previous page/i }));
    await user.click(screen.getByRole("button", { name: /next page/i }));
    await user.click(screen.getByRole("button", { name: /go to page 4/i }));

    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
    expect(onPageChange).toHaveBeenNthCalledWith(3, 4);
  });

  it("disables boundary and in-flight controls", () => {
    const { rerender } = render(
      <Pagination currentPage={1} totalPages={3} totalCount={50} pageSize={20} onPageChange={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next page/i })).toBeEnabled();

    rerender(
      <Pagination
        currentPage={2}
        totalPages={3}
        totalCount={50}
        pageSize={20}
        onPageChange={vi.fn()}
        loading
      />
    );

    expect(screen.getByRole("button", { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled();
  });

  it("hides navigation controls for one page while retaining the total", () => {
    render(
      <Pagination currentPage={1} totalPages={1} totalCount={1} pageSize={20} onPageChange={vi.fn()} />
    );

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) => element?.tagName === "P" && element.textContent === "Showing 1–1 of 1 record"
      )
    ).toBeInTheDocument();
  });

  it("uses compact ellipses while keeping nearby and boundary pages clickable", async () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={5}
        totalPages={10}
        totalCount={200}
        pageSize={20}
        onPageChange={onPageChange}
      />
    );

    expect(screen.getAllByText("…")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /^go to page 1$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /go to page 4/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /current page, page 5/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /go to page 6/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /go to page 10/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /go to page 10/i }));
    expect(onPageChange).toHaveBeenCalledWith(10);
  });
});
