import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConsentGate from "./ConsentGate";

function renderGate(overrides: Partial<React.ComponentProps<typeof ConsentGate>> = {}) {
  const props = {
    language: "en" as const,
    onLanguageChange: vi.fn(),
    onConsent: vi.fn(),
    ...overrides,
  };
  render(<ConsentGate {...props} />);
  return props;
}

describe("ConsentGate", () => {
  it("keeps continue disabled until the candidate actively opts in", async () => {
    const user = userEvent.setup();
    const props = renderGate();

    const button = screen.getByTestId("consent-continue");
    expect(button).toBeDisabled();

    await user.click(screen.getByTestId("consent-checkbox"));
    expect(button).toBeEnabled();

    await user.click(button);
    expect(props.onConsent).toHaveBeenCalledTimes(1);
  });

  it("renders Indonesian copy when the candidate switches language", async () => {
    const user = userEvent.setup();
    const props = renderGate({ language: "id" });

    expect(screen.getByText("Sebelum memulai")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "English" }));
    expect(props.onLanguageChange).toHaveBeenCalledWith("en");
  });

  it("shows a server error without enabling submission", () => {
    renderGate({ error: "We could not save your consent." });

    expect(screen.getByRole("alert")).toHaveTextContent("could not save");
    expect(screen.getByTestId("consent-continue")).toBeDisabled();
  });
});
