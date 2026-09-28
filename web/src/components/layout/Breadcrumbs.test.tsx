import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { BreadcrumbProvider, Breadcrumbs, useBreadcrumbLabel } from "./Breadcrumbs";

function Names() {
  useBreadcrumbLabel("assessments:1", "Product engineer");
  useBreadcrumbLabel("sessions:9", "Maya");
  useBreadcrumbLabel("vacancies:3", "Senior designer");
  return null;
}

describe("Breadcrumb hierarchy", () => {
  it("uses record names and links to actual ancestor pages", async () => {
    render(<MemoryRouter initialEntries={["/assessments/1/sessions/9/portfolio"]}><BreadcrumbProvider><Names /><Breadcrumbs /></BreadcrumbProvider></MemoryRouter>);
    const nav = within(screen.getByRole("navigation", { name: "Breadcrumb" }));
    expect(await nav.findByRole("link", { name: "Product engineer" })).toHaveAttribute("href", "/assessments/1/invite");
    expect(nav.getByText("Maya")).toBeInTheDocument();
    expect(nav.getByText("Portfolio")).toHaveAttribute("aria-current", "page");
  });
  it("identifies the vacancy and edit mode without inventing a detail route", async () => {
    render(<MemoryRouter initialEntries={["/vacancies/3/edit"]}><BreadcrumbProvider><Names /><Breadcrumbs /></BreadcrumbProvider></MemoryRouter>);
    expect(await screen.findByText("Senior designer")).toBeInTheDocument();
    expect(screen.getByText("Edit")).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Vacancies" })).toHaveAttribute("href", "/vacancies");
    expect(screen.queryByRole("link", { name: "Senior designer" })).not.toBeInTheDocument();
  });
});
