import { describe, it, expect } from "vitest";
import { Routes, Route } from "react-router-dom";
import { screen } from "@testing-library/react";
import ProtectedRoute from "./ProtectedRoute";
import { authAtom } from "@/stores/authAtom";
import { renderWithProviders } from "@/test/renderWithProviders";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<div>login page</div>} />
      <Route element={<ProtectedRoute />}>
        <Route path="/secret" element={<div>secret page</div>} />
      </Route>
    </Routes>
  );
}

describe("ProtectedRoute", () => {
  it("redirects to /login without a token", () => {
    renderWithProviders(<App />, { route: "/secret", atoms: [[authAtom, { token: null }]] });
    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(screen.queryByText("secret page")).not.toBeInTheDocument();
  });

  it("renders the nested route with a token", () => {
    renderWithProviders(<App />, { route: "/secret", atoms: [[authAtom, { token: "t" }]] });
    expect(screen.getByText("secret page")).toBeInTheDocument();
  });
});
