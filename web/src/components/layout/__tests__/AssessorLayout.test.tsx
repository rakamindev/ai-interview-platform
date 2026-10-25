import { describe, it, expect } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AssessorLayout from "../AssessorLayout";

function renderLayout(initialPath = "/assessments") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AssessorLayout />}>
          <Route path="/assessments" element={<div>Assessments page</div>} />
          <Route path="/vacancies" element={<div>Vacancies page</div>} />
          <Route path="/admin-invitations" element={<div>Admin invitations page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("AssessorLayout — mobile drawer (UI enhancement)", () => {
  it("opens the drawer from the hamburger button", async () => {
    renderLayout();
    const trigger = screen.getByRole("button", { name: "Open navigation menu" });
    await userEvent.click(trigger);

    const dialog = await screen.findByRole("dialog");
    // Drawer contains the nav links (Assessments + Vacancies) and logout.
    expect(within(dialog).getByRole("link", { name: /assessments/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /vacancies/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /admin invitations/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /logout/i })).toBeInTheDocument();
  });

  it("auto-closes the drawer after navigating via a drawer link", async () => {
    renderLayout();
    const trigger = screen.getByRole("button", { name: "Open navigation menu" });
    await userEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");

    await userEvent.click(within(dialog).getByRole("link", { name: /vacancies/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    // And the navigation actually happened.
    expect(screen.getByText("Vacancies page")).toBeInTheDocument();
  });

  it("closes the drawer on Escape", async () => {
    renderLayout();
    const trigger = screen.getByRole("button", { name: "Open navigation menu" });
    await userEvent.click(trigger);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("keeps the inline desktop nav links rendered", () => {
    renderLayout();
    expect(screen.getByRole("link", { name: "Assessments" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Vacancies" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Admin Invitations" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
  });
});
