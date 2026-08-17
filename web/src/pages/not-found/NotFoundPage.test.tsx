import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotFoundPage from "./NotFoundPage";

describe("NotFoundPage", () => {
  it("renders 404 page with navigation actions", () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/404 — Page Not Found/i)).toBeInTheDocument();
    expect(screen.getByText(/We couldn't find this page/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Go Back/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Assessments Dashboard/i })).toBeInTheDocument();
  });
});
