import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import AssessorLayout from "./AssessorLayout";

it("only clears the token after logout confirmation", async () => {
  localStorage.setItem("auth_token", "test-token");
  render(<MemoryRouter><AssessorLayout /></MemoryRouter>);
  fireEvent.click(screen.getAllByRole("button", { name: "Log out" })[0]);
  const dialog = await screen.findByRole("alertdialog");
  expect(localStorage.getItem("auth_token")).toBe("test-token");
  fireEvent.click(within(dialog).getByRole("button", { name: "Stay signed in" }));
  expect(localStorage.getItem("auth_token")).toBe("test-token");
  fireEvent.click(screen.getAllByRole("button", { name: "Log out" })[0]);
  fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Log out" }));
  expect(localStorage.getItem("auth_token")).toBeNull();
});
