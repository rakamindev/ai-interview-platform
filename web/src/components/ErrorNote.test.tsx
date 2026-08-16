import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorNote from "@/components/ErrorNote";

describe("ErrorNote", () => {
  it("renders the message as an alert", () => {
    render(<ErrorNote message="Something failed" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something failed");
  });
});
