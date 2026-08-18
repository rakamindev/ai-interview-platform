import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createStore, Provider } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssessorLayout from "@/components/layout/AssessorLayout";
import { authAtom } from "@/stores/authAtom";
import { tenantAtom } from "@/stores/tenantAtom";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

function renderLayout(initialEntries: string[] = ["/assessments"]) {
  const store = createStore();
  store.set(authAtom, { token: "test-token" });
  store.set(tenantAtom, { id: "1", name: "Acme Corp" });

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route element={<AssessorLayout />}>
            <Route path="/assessments" element={<div>Assessments content</div>} />
            <Route path="/vacancies" element={<div>Vacancies content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>
  );
  return store;
}

describe("AssessorLayout", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    localStorage.clear();
  });

  it("renders the nav links and the routed page content", () => {
    renderLayout(["/assessments"]);

    expect(screen.getAllByRole("link", { name: /assessments/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /vacancies/i }).length).toBeGreaterThan(0);
    expect(screen.getByText("Assessments content")).toBeInTheDocument();
  });

  it("shows the current tenant name from the tenant atom", () => {
    renderLayout(["/assessments"]);

    expect(screen.getByText(/tenant: acme corp/i)).toBeInTheDocument();
  });

  it("clears auth state, clears the stored token, and navigates to /login on logout", async () => {
    const user = userEvent.setup();
    localStorage.setItem("auth_token", "test-token");
    const store = renderLayout(["/assessments"]);

    const [logoutButton] = screen.getAllByRole("button", { name: /logout/i });
    await user.click(logoutButton);

    expect(navigateMock).toHaveBeenCalledWith("/login");
    expect(store.get(authAtom).token).toBeNull();
    expect(localStorage.getItem("auth_token")).toBeNull();
  });
});
