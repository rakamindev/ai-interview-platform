import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "jotai";
import AssessorLayout from "../AssessorLayout";

describe("AssessorLayout component", () => {
  const renderLayout = () => {
    return render(
      <Provider>
        <MemoryRouter initialEntries={["/assessments"]}>
          <AssessorLayout />
        </MemoryRouter>
      </Provider>
    );
  };

  it("renders Rakamin AI brand and main navigation links", () => {
    renderLayout();

    expect(screen.getByText("Rakamin AI")).toBeInTheDocument();
    expect(screen.getByText("Assessments")).toBeInTheDocument();
    expect(screen.getByText("Vacancies")).toBeInTheDocument();
  });

  it("toggles mobile menu drawer when mobile hamburger button is clicked", () => {
    renderLayout();

    const menuButton = screen.getByRole("button", { name: /toggle navigation menu/i });
    expect(menuButton).toBeInTheDocument();

    // Mobile drawer should open on click
    fireEvent.click(menuButton);
    expect(screen.getByRole("navigation", { name: /mobile navigation/i })).toBeInTheDocument();
  });
});
