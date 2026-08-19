import { describe, it, expect } from "vite-plus/test";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";
import AuthShell from "./AuthShell";

describe("AuthShell", () => {
  it("renders the title, subtitle and children", () => {
    renderWithProviders(
      <AuthShell title="Sign in" subtitle="Welcome back">
        <input placeholder="email" />
      </AuthShell>,
    );
    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("email")).toBeInTheDocument();
  });

  it("renders the brand voice bars in the aside and mobile header", () => {
    const { container } = renderWithProviders(
      <AuthShell title="Sign in" subtitle="Welcome back">
        <span>form</span>
      </AuthShell>,
    );
    expect(screen.getAllByText("AI Interview")).toHaveLength(2);
    expect(container.querySelectorAll(".animate-voice-bar")).toHaveLength(10);
  });
});
