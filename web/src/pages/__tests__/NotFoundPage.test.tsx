import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "@/App";
import NotFoundPage from "@/pages/NotFoundPage";

vi.mock("@/services/auth", () => ({ authApi: { login: vi.fn() } }));

describe("NotFoundPage (F3)", () => {
  it("renders a 404 message with a way back home", () => {
    render(
      <MemoryRouter initialEntries={["/whatever"]}>
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to home/i })).toHaveAttribute("href", "/");
  });

  it("F3: an unmatched route like /signup renders the 404 page instead of a blank screen", () => {
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("404")).toBeInTheDocument();
  });
});
