// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { authAtom } from "@/stores/authAtom";

function renderRoute(token: string | null, initialEntry = "/assessments") {
  const store = createStore();
  store.set(authAtom, { token });

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/assessments" element={<div>Assessment workspace</div>} />
          </Route>
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

describe("ProtectedRoute", () => {
  it("redirects unauthenticated users to login", () => {
    renderRoute(null);

    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Assessment workspace")).not.toBeInTheDocument();
  });

  it("renders the protected route for authenticated users", () => {
    renderRoute("test-token");

    expect(screen.getByText("Assessment workspace")).toBeInTheDocument();
  });
});
