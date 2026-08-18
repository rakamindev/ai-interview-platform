import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AssessorLayout from "./AssessorLayout";

describe("AssessorLayout Responsive Navigation & Accessibility", () => {
  it("renders Assessments and Vacancies navigation links inside a nav landmark", () => {
    render(
      <MemoryRouter>
        <AssessorLayout />
      </MemoryRouter>
    );

    const nav = screen.getByRole("navigation", { name: /primary navigation/i });
    expect(nav).toBeInTheDocument();

    const assessmentsLink = screen.getByRole("link", { name: /assessments/i });
    expect(assessmentsLink).toBeInTheDocument();
    expect(assessmentsLink).toHaveAttribute("href", "/assessments");

    const vacanciesLink = screen.getByRole("link", { name: /vacancies/i });
    expect(vacanciesLink).toBeInTheDocument();
    expect(vacanciesLink).toHaveAttribute("href", "/vacancies");
  });

  it("renders brand logo link and logout button with accessible names", () => {
    render(
      <MemoryRouter>
        <AssessorLayout />
      </MemoryRouter>
    );

    const homeLink = screen.getByRole("link", { name: /rakamin ai interview home/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute("href", "/assessments");

    const logoutButtons = screen.getAllByRole("button", { name: /logout/i });
    expect(logoutButtons.length).toBeGreaterThan(0);
    logoutButtons.forEach((btn) => {
      expect(btn).toBeInTheDocument();
    });
  });
});
