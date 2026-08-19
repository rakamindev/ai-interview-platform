import { describe, it, expect } from "vite-plus/test";
import { screen } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import { createStore } from "jotai";
import { renderWithProviders } from "@/test/utils";
import ProtectedRoute from "./ProtectedRoute";
import { authAtom } from "@/stores/authAtom";

function encodeJwtWithRole(role: string): string {
  const payload = btoa(JSON.stringify({ role })).replace(/\+/g, "-").replace(/\//g, "_");
  return `header.${payload}.signature`;
}

function renderProtected(initialEntries: string[], token: string | null) {
  const store = createStore();
  store.set(authAtom, { token });
  return renderWithProviders(
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/protected" element={<div>Protected content</div>} />
      </Route>
      <Route path="/login" element={<div>Login page</div>} />
      <Route path="/access-denied" element={<div>Access denied</div>} />
    </Routes>,
    { initialEntries, store },
  );
}

describe("ProtectedRoute", () => {
  it("redirects to /login when no token is present", () => {
    renderProtected(["/protected"], null);
    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("redirects to /access-denied when the token has no admin role", () => {
    renderProtected(["/protected"], encodeJwtWithRole("candidate"));
    expect(screen.getByText("Access denied")).toBeInTheDocument();
  });

  it("renders the outlet for admin tokens", () => {
    renderProtected(["/protected"], encodeJwtWithRole("admin"));
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });
});
