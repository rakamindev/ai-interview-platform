import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import PageHeader from "../PageHeader";

describe("PageHeader", () => {
  it("renders an accessible back link when backTo is given", () => {
    render(
      <MemoryRouter>
        <PageHeader backTo="/assessments" backLabel="Assessments" title="Sessions" subtitle="Backend Engineer">
          <button>Invite</button>
        </PageHeader>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Assessments" })).toHaveAttribute("href", "/assessments");
    expect(screen.getByRole("heading", { name: "Sessions" })).toBeInTheDocument();
    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite" })).toBeInTheDocument();
  });

  it("omits the back link when there is nowhere to go back to", () => {
    render(
      <MemoryRouter>
        <PageHeader title="Assessments" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
