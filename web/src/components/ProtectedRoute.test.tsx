vi.mock("@/services/api", () => ({ startRefreshTimer: vi.fn() }));

vi.hoisted(() => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      get length() { return store.size; },
      key: (i: number) => [...store.keys()][i] ?? null,
    },
    configurable: true,
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, beforeEach } from "vitest";
import ProtectedRoute from "./ProtectedRoute";
import { setAuth, clearAuth } from "@/stores/authAtom";

function renderWithRouter(initialEntry = "/protected") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<ProtectedRoute isAuthReady />}>
          <Route path="/protected" element={<div data-testid="protected">Protected Content</div>} />
        </Route>
        <Route path="/login" element={<div data-testid="login">Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  clearAuth();
});

describe("ProtectedRoute", () => {
  it("renders null when auth is not ready", () => {
    const { container } = render(
      <MemoryRouter>
        <Routes>
          <Route element={<ProtectedRoute isAuthReady={false} />}>
            <Route path="/" element={<div>Child</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(container.innerHTML).toBe("");
  });

  it("redirects to /login when unauthenticated", () => {
    renderWithRouter();
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("renders outlet children when authenticated", () => {
    setAuth("test-token", { id: "1", email: "a@b.com", role: "candidate" });
    renderWithRouter();
    expect(screen.getByTestId("protected")).toHaveTextContent("Protected Content");
  });

  it("redirects to /login when auth is cleared after mount", async () => {
    setAuth("test-token", { id: "1", email: "a@b.com", role: "candidate" });
    renderWithRouter();
    expect(screen.getByTestId("protected")).toBeInTheDocument();
    clearAuth();
    await waitFor(() => {
      expect(screen.getByText("Login Page")).toBeInTheDocument();
    });
  });
});
