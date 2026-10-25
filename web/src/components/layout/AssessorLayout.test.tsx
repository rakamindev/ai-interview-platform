import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import AssessorLayout from "./AssessorLayout";
import { clearToken } from "@/stores/authAtom";

vi.mock("@/stores/authAtom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/stores/authAtom")>();
  return { ...actual, clearToken: vi.fn() };
});

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/assessments"]}>
      <Routes>
        <Route element={<AssessorLayout />}>
          <Route path="/assessments" element={<div>Assessments page content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("AssessorLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the routed page content via Outlet", () => {
    renderLayout();
    expect(screen.getByText("Assessments page content")).toBeInTheDocument();
  });

  it("exposes every nav destination, the tenant, and logout through the mobile menu — the desktop row disappears under md:hidden, so this is the only reachable path on a phone viewport", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole("button", { name: /open menu/i }));

    // jsdom doesn't evaluate the `md:hidden` CSS that hides the desktop row on a phone
    // viewport, so it stays in the DOM — scope to the open menu to avoid matching it too.
    const menu = within(await screen.findByRole("menu"));
    expect(menu.getByRole("menuitem", { name: /assessments/i })).toBeInTheDocument();
    expect(menu.getByRole("menuitem", { name: /vacancies/i })).toBeInTheDocument();
    expect(menu.getByText(/demo tenant/i)).toBeInTheDocument();
    expect(menu.getByRole("menuitem", { name: /logout/i })).toBeInTheDocument();
  });

  it("logs out from the mobile menu the same way the desktop button does", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole("button", { name: /open menu/i }));
    await user.click(await screen.findByRole("menuitem", { name: /logout/i }));

    expect(clearToken).toHaveBeenCalled();
  });
});
