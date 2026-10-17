import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConsentScreen from "./ConsentScreen";

const CONSENT_TEXT = [
  "WHAT WE COLLECT",
  "- Your voice recording and the transcript of your answers",
  "YOUR RIGHTS",
  "- You can withdraw this consent at any time before the interview.",
].join("\n");

describe("ConsentScreen", () => {
  it("renders the full consent text", () => {
    render(
      <ConsentScreen
        consentText={CONSENT_TEXT}
        consentVersion="v1"
        onAccept={() => {}}
        onRevoke={() => {}}
        accepting={false}
      />
    );

    expect(screen.getByText(/WHAT WE COLLECT/)).toBeInTheDocument();
    expect(screen.getByText(/YOUR RIGHTS/)).toBeInTheDocument();
  });

  it("disables accept until the candidate acknowledges", () => {
    render(
      <ConsentScreen
        consentText={CONSENT_TEXT}
        consentVersion="v1"
        onAccept={() => {}}
        onRevoke={() => {}}
        accepting={false}
      />
    );

    const accept = screen.getByRole("button", { name: /I consent — continue/ });
    expect(accept).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(accept).toBeEnabled();
  });

  it("calls onAccept with the version when accepted", () => {
    const onAccept = vi.fn();
    render(
      <ConsentScreen
        consentText={CONSENT_TEXT}
        consentVersion="v1"
        onAccept={onAccept}
        onRevoke={() => {}}
        accepting={false}
      />
    );

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /I consent — continue/ }));

    expect(onAccept).toHaveBeenCalledWith("v1");
  });

  it("calls onRevoke when withdrawn", () => {
    const onRevoke = vi.fn();
    render(
      <ConsentScreen
        consentText={CONSENT_TEXT}
        consentVersion="v1"
        onAccept={() => {}}
        onRevoke={onRevoke}
        accepting={false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Withdraw consent/ }));

    expect(onRevoke).toHaveBeenCalled();
  });

  it("disables all actions while accepting", () => {
    render(
      <ConsentScreen
        consentText={CONSENT_TEXT}
        consentVersion="v1"
        onAccept={() => {}}
        onRevoke={() => {}}
        accepting={true}
      />
    );

    expect(screen.getByRole("button", { name: /I consent — continue/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Withdraw consent/ })).toBeDisabled();
  });

  it("shows an error message when provided", () => {
    render(
      <ConsentScreen
        consentText={CONSENT_TEXT}
        consentVersion="v1"
        onAccept={() => {}}
        onRevoke={() => {}}
        accepting={false}
        error="Failed to record consent. Please try again."
      />
    );

    expect(screen.getByText(/Failed to record consent/)).toBeInTheDocument();
  });
});