import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import PrivateNavbar from "./navbar";

describe("PrivateNavbar (Ottodot pattern)", () => {
  it("renders the Rakamin brand logo and AI Interview title", () => {
    renderWithProviders(<PrivateNavbar />);

    expect(screen.getByText("Rakamin")).toBeInTheDocument();
    expect(screen.getByText(/AI Interview/i)).toBeInTheDocument();
  });

  it("renders navigation pills for Assessments and Vacancies", () => {
    renderWithProviders(<PrivateNavbar />);

    expect(screen.getByRole("link", { name: /Assessments/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Vacancies/i })).toBeInTheDocument();
  });

  it("renders mobile drawer trigger button", () => {
    renderWithProviders(<PrivateNavbar />);

    const menuButton = screen.getByRole("button", { name: /open navigation menu/i });
    expect(menuButton).toBeInTheDocument();
  });
});
