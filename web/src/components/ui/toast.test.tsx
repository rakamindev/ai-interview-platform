import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { notify, Toaster } from "./toast";

afterEach(() => vi.useRealTimers());
it("updates one notice without stacking repeated actions and supports dismissal", () => {
  vi.useFakeTimers();
  render(<Toaster />);
  act(() => notify("Link copied."));
  act(() => notify("Link copied."));
  expect(screen.getAllByText("Link copied.")).toHaveLength(1);
  act(() => notify("Copy failed.", "error"));
  expect(screen.queryByText("Link copied.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
  expect(screen.getByText("Copy failed.").parentElement).toHaveAttribute("data-state", "closed");
  act(() => vi.advanceTimersByTime(240));
  expect(screen.queryByText("Copy failed.")).not.toBeInTheDocument();
});
it("pauses dismissal while the notification is hovered", () => {
  vi.useFakeTimers();
  render(<Toaster />);
  act(() => notify("Saved."));
  fireEvent.mouseEnter(screen.getByText("Saved.").parentElement!);
  act(() => vi.advanceTimersByTime(6000));
  expect(screen.getByText("Saved.")).toBeInTheDocument();
  fireEvent.mouseLeave(screen.getByText("Saved.").parentElement!);
  act(() => vi.advanceTimersByTime(5000));
  expect(screen.getByText("Saved.").parentElement).toHaveAttribute("data-state", "closed");
  act(() => vi.advanceTimersByTime(240));
  expect(screen.queryByText("Saved.")).not.toBeInTheDocument();
});

it("does not remove a new notification when it replaces one that is closing", () => {
  vi.useFakeTimers();
  render(<Toaster />);
  act(() => notify("First"));
  fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
  act(() => vi.advanceTimersByTime(75));
  act(() => notify("Second"));
  act(() => vi.advanceTimersByTime(240));
  expect(screen.getByText("Second").parentElement).toHaveAttribute("data-state", "open");
});
