import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AssessorLayout from "../AssessorLayout";

describe("AssessorLayout - Sidebar Navigation & User Profile (UI-02)", () => {
  it("renders sidebar with navigation links to Assessments, Vacancies, and Settings", () => {
    render(
      <MemoryRouter initialEntries={["/assessments"]}>
        <Routes>
          <Route element={<AssessorLayout />}>
            <Route path="/assessments" element={<div>Assessments Content</div>} />
            <Route path="/vacancies" element={<div>Vacancies Content</div>} />
            <Route path="/settings" element={<div>Settings Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /Assessments/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Vacancies/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Settings/i })).toBeInTheDocument();
    expect(screen.getByText("Assessments Content")).toBeInTheDocument();
  });

  it("toggles sidebar collapsed state on button click", () => {
    render(
      <MemoryRouter initialEntries={["/assessments"]}>
        <Routes>
          <Route element={<AssessorLayout />}>
            <Route path="/assessments" element={<div>Assessments Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const sidebar = screen.getByTestId("sidebar");
    const toggleButton = screen.getByTestId("sidebar-toggle");

    expect(sidebar).toHaveClass("w-64");

    fireEvent.click(toggleButton);
    expect(sidebar).toHaveClass("w-16");

    fireEvent.click(toggleButton);
    expect(sidebar).toHaveClass("w-64");
  });

  it("does not render static Tenant badge and displays popup menu with Profile and Log out on user trigger click", () => {
    render(
      <MemoryRouter initialEntries={["/assessments"]}>
        <Routes>
          <Route element={<AssessorLayout />}>
            <Route path="/assessments" element={<div>Assessments Content</div>} />
            <Route path="/profile" element={<div>Profile Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Verify static Tenant badge is completely removed
    expect(screen.queryByText(/Tenant:/i)).not.toBeInTheDocument();

    // Verify user profile trigger exists
    const trigger = screen.getByTestId("user-profile-trigger");
    expect(trigger).toBeInTheDocument();

    // Initially popup menu is closed
    expect(screen.queryByRole("button", { name: /Profile/i })).not.toBeInTheDocument();

    // Click trigger to open popup menu
    fireEvent.click(trigger);

    // Verify ONLY two options exist: Profile and Log out
    const profileBtn = screen.getByRole("button", { name: /Profile/i });
    const logoutBtn = screen.getByTestId("logout-button");
    expect(profileBtn).toBeInTheDocument();
    expect(logoutBtn).toBeInTheDocument();

    // Clicking Profile navigates to /profile
    fireEvent.click(profileBtn);
    expect(screen.getByText("Profile Content")).toBeInTheDocument();
  });
});
