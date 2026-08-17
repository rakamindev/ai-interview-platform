import { describe, it, expect, beforeEach } from "vite-plus/test";
import { renderWithProviders } from "@/test/utils";
import { fireEvent, screen } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import AccessDeniedPage from "./AccessDeniedPage";

function renderAccessDenied() {
  renderWithProviders(
    <Routes>
      <Route path="/denied" element={<AccessDeniedPage />} />
      <Route path="/login" element={<div>LOGIN PAGE</div>} />
    </Routes>,
    { route: "/denied" },
  );
}

describe("AccessDeniedPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the access-denied copy", () => {
    renderAccessDenied();

    expect(screen.getByText("No assessor access")).toBeInTheDocument();
    expect(screen.getByText(/Assessor tools are available to admin accounts/)).toBeInTheDocument();
  });

  it("signs out: clears the token and navigates to login", () => {
    localStorage.setItem("auth_token", "jwt");
    renderAccessDenied();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument();
    expect(localStorage.getItem("auth_token")).toBeNull();
  });
});
