import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// authAtom reads import.meta.env.VITE_DEV_TOKEN when the module is loaded. Stub
// it to undefined BEFORE importing so the atom's default is deterministic.
vi.stubEnv("VITE_DEV_TOKEN", undefined);

const { default: ProtectedRoute } = await import("./ProtectedRoute");
const { authAtom } = await import("@/stores/authAtom");
const { createStore, Provider: JotaiProvider } = await import("jotai");

function renderRoute(token: string | null) {
  const store = createStore();
  store.set(authAtom, { token });

  return render(
    <JotaiProvider store={store}>
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<div>Protected content</div>} />
          </Route>
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    </JotaiProvider>
  );
}

describe("ProtectedRoute", () => {
  it("redirects to /login when no token is present", () => {
    renderRoute(null);

    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders the outlet when a token is present", () => {
    renderRoute("jwt-token");

    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
  });
});