import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConsentModal from "./ConsentModal";
import ConsentBanner from "./ConsentBanner";
import PrepHub from "./PrepHub";

describe("ConsentModal (Gating Confirmation Dialog)", () => {
  it("renders UU PDP privacy disclosures when open", () => {
    render(
      <ConsentModal
        open={true}
        onOpenChange={vi.fn()}
        onConfirmConsent={vi.fn()}
      />
    );

    expect(screen.getByText("Your data, your choice")).toBeInTheDocument();
    expect(screen.getByText(/Personal Data Protection Law/i)).toBeInTheDocument();
    expect(screen.getByText(/Voice & Response Evaluation/i)).toBeInTheDocument();
    expect(screen.getByText(/Human Assessor in the Loop/i)).toBeInTheDocument();
  });

  it("calls onConfirmConsent and closes when clicking consent button", () => {
    const onConfirmConsent = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConsentModal
        open={true}
        onOpenChange={onOpenChange}
        onConfirmConsent={onConfirmConsent}
      />
    );

    const consentBtn = screen.getByRole("button", { name: /I consent to AI processing/i });
    fireEvent.click(consentBtn);

    expect(onConfirmConsent).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onDecline and closes when clicking decline button", () => {
    const onDecline = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConsentModal
        open={true}
        onOpenChange={onOpenChange}
        onConfirmConsent={vi.fn()}
        onDecline={onDecline}
      />
    );

    const declineBtn = screen.getByRole("button", { name: /Decline \/ Go Back/i });
    fireEvent.click(declineBtn);

    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not render dialog content when closed", () => {
    render(
      <ConsentModal
        open={false}
        onOpenChange={vi.fn()}
        onConfirmConsent={vi.fn()}
      />
    );

    expect(screen.queryByText("Your data, your choice")).not.toBeInTheDocument();
  });
});

describe("ConsentBanner", () => {
  it("allows consent and notifies the caller", () => {
    const onConsentChange = vi.fn();
    render(<ConsentBanner onConsentChange={onConsentChange} />);

    fireEvent.click(screen.getByRole("button", { name: /I consent to AI processing/i }));
    expect(onConsentChange).toHaveBeenCalledWith(true);
    expect(screen.getByText(/may withdraw consent/i)).toBeInTheDocument();
  });

  it("allows declining AI processing", () => {
    const onConsentChange = vi.fn();
    render(<ConsentBanner onConsentChange={onConsentChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Decline AI processing/i }));
    expect(onConsentChange).toHaveBeenCalledWith(false);
    expect(screen.getByText(/human assessor will review/i)).toBeInTheDocument();
  });

  it("renders the UU PDP notice copy", () => {
    render(<ConsentBanner />);
    expect(screen.getByText(/Personal Data Protection Law/i)).toBeInTheDocument();
  });
});

describe("PrepHub", () => {
  it("shows role title and skill areas", () => {
    render(
      <PrepHub roleTitle="Product Manager" timeLimitMin={45} skillAreas={["Strategy", "Execution"]} />
    );

    expect(screen.getByText(/Product Manager/)).toBeInTheDocument();
    expect(screen.getByText("Strategy")).toBeInTheDocument();
    expect(screen.getByText("Execution")).toBeInTheDocument();
  });

  it("reveals practice questions on click", () => {
    render(<PrepHub roleTitle="Role" timeLimitMin={30} skillAreas={[]} />);

    const trigger = screen.getByRole("button", { name: /practice/i });
    fireEvent.click(trigger);

    expect(screen.getByText(/recent project you're proud of/)).toBeInTheDocument();
    expect(screen.getByText(/not recorded or scored/)).toBeInTheDocument();
  });
});
