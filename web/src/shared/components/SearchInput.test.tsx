import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import SearchInput from "./SearchInput";

describe("SearchInput", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces onSearch while typing", () => {
    const onSearch = vi.fn();
    render(<SearchInput placeholder="Search..." onSearch={onSearch} />);

    fireEvent.change(screen.getByPlaceholderText("Search..."), { target: { value: "backend" } });
    expect(onSearch).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(350));
    expect(onSearch).toHaveBeenCalledWith("backend");
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it("shows a clear button once there's text and clears it immediately on click", () => {
    const onSearch = vi.fn();
    render(<SearchInput placeholder="Search..." onSearch={onSearch} />);

    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search..."), { target: { value: "backend" } });
    fireEvent.click(screen.getByLabelText("Clear search"));

    expect(screen.getByPlaceholderText("Search...")).toHaveValue("");
    act(() => vi.advanceTimersByTime(350));
    expect(onSearch).toHaveBeenCalledWith("");
  });
});
