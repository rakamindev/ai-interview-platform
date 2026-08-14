import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConsentScreen from "@/components/interview/ConsentScreen";
import type { ConsentPolicyContent } from "@/types";

const policy: ConsentPolicyContent = {
  data_collected: ["Your voice recording", "Your name"],
  purposes: ["To evaluate your assessment"],
  retention: "Kept for the hiring process.",
  rights: ["Access your data", "Request deletion"],
  contact: "Contact the inviting company.",
};

function renderScreen(overrides: Partial<Parameters<typeof ConsentScreen>[0]> = {}) {
  const props = {
    roleTitle: "Backend Engineer",
    policy,
    policyVersion: "1.0",
    submitting: false,
    onAccept: vi.fn(),
    onDecline: vi.fn(),
    ...overrides,
  };
  render(<ConsentScreen {...props} />);
  return props;
}

describe("ConsentScreen", () => {
  it("renders the full disclosure: data, purposes, retention, rights, contact", () => {
    renderScreen();
    expect(screen.getByText("What we collect")).toBeInTheDocument();
    expect(screen.getByText("Your voice recording")).toBeInTheDocument();
    expect(screen.getByText("Why we use it")).toBeInTheDocument();
    expect(screen.getByText(/Kept for the hiring process/)).toBeInTheDocument();
    expect(screen.getByText("Access your data")).toBeInTheDocument();
    expect(screen.getByText("Contact the inviting company.")).toBeInTheDocument();
  });

  it("keeps the start button disabled until consent is checked", () => {
    renderScreen();
    const start = screen.getByRole("button", { name: /Start Interview/ });
    expect(start).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(start).toBeEnabled();
  });

  it("calls onAccept when the agreed start button is clicked", () => {
    const props = renderScreen();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Start Interview/ }));
    expect(props.onAccept).toHaveBeenCalledTimes(1);
  });

  it("shows a decline screen and records refusal when the candidate declines", () => {
    const props = renderScreen();
    fireEvent.click(screen.getByRole("button", { name: /I don't consent/i }));
    expect(props.onDecline).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/You've chosen not to continue/i)).toBeInTheDocument();
  });

  it("allows going back from the decline screen", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: /I don't consent/i }));
    fireEvent.click(screen.getByRole("button", { name: /Go back/i }));
    expect(screen.getByRole("button", { name: /Start Interview/ })).toBeInTheDocument();
  });
});
