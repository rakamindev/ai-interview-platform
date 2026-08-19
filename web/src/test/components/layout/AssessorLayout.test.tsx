import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AssessorLayout from "@/components/layout/AssessorLayout";

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/assessments"]}>
      <Routes>
        <Route element={<AssessorLayout />}>
          <Route path="/assessments" element={<div>Page content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("AssessorLayout", () => {
  it("keeps accessible names for nav links and logout when their text labels are visually hidden on mobile", () => {
    renderLayout();

    expect(screen.getByRole("link", { name: "Assessments" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Vacancies" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });

  it("renders the tenant badge and page content", () => {
    renderLayout();

    expect(screen.getByText(/Demo Tenant/)).toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });
});
