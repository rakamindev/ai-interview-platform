import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AssessorLayout from "../AssessorLayout";

describe("AssessorLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders sidebar with brand, navigation links, and tenant workspace badge", () => {
    render(
      <MemoryRouter initialEntries={["/assessments"]}>
        <Routes>
          <Route element={<AssessorLayout />}>
            <Route path="/assessments" element={<div>Assessments Content</div>} />
            <Route path="/vacancies" element={<div>Vacancies Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Brand and logo
    expect(screen.getAllByText("Rakamin").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/AI Interview/i).length).toBeGreaterThan(0);

    // Nav items in sidebar
    expect(screen.getAllByText("Assessments").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Vacancies").length).toBeGreaterThan(0);

    // Content rendered in Outlet
    expect(screen.getByText("Assessments Content")).toBeInTheDocument();

    // Logout button present
    expect(screen.getAllByText("Log out").length).toBeGreaterThan(0);
  });

  it("renders breadcrumbs dynamically for subroutes", () => {
    render(
      <MemoryRouter initialEntries={["/assessments/new"]}>
        <Routes>
          <Route element={<AssessorLayout />}>
            <Route path="/assessments/new" element={<div>New Assessment Form</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("New Assessment")).toBeInTheDocument();
    expect(screen.getByText("New Assessment Form")).toBeInTheDocument();
  });
});
