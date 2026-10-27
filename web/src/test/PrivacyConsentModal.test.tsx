import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PrivacyConsentModal from "../components/interview/PrivacyConsentModal";

describe("PrivacyConsentModal (UU PDP No. 27/2022 Compliance)", () => {
  it("renders privacy terms and displays UU PDP compliance badge", () => {
    render(
      <PrivacyConsentModal
        open={true}
        onConsentAccepted={vi.fn()}
        candidateName="Wisman Nur"
        roleTitle="Senior Staff Engineer"
      />
    );

    expect(screen.getByText(/Kepatuhan UU PDP No. 27\/2022/i)).toBeInTheDocument();
    expect(screen.getByText(/Persetujuan Pemrosesan Data & Asesmen AI/i)).toBeInTheDocument();
    expect(screen.getByText(/Wisman Nur/i)).toBeInTheDocument();
  });

  it("disables continue button until consent checkbox is explicitly checked", () => {
    const handleConsent = vi.fn();
    render(
      <PrivacyConsentModal
        open={true}
        onConsentAccepted={handleConsent}
        candidateName="Budi Pratama"
      />
    );

    const continueButton = screen.getByRole("button", {
      name: /Lanjutkan ke Pengecekan Perangkat/i,
    });
    expect(continueButton).toBeDisabled();

    // Check the agreement checkbox
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(continueButton).not.toBeDisabled();

    // Click continue
    fireEvent.click(continueButton);
    expect(handleConsent).toHaveBeenCalledTimes(1);
  });

  it("toggles detailed legal notices when toggle button is clicked", () => {
    render(
      <PrivacyConsentModal
        open={true}
        onConsentAccepted={vi.fn()}
      />
    );

    expect(screen.queryByText(/Ketentuan Tambahan Retensi & Keamanan Data/i)).not.toBeInTheDocument();

    const toggleButton = screen.getByText(/Lihat rincian hak hukum Anda/i);
    fireEvent.click(toggleButton);

    expect(screen.getByText(/Ketentuan Tambahan Retensi & Keamanan Data/i)).toBeInTheDocument();
    expect(screen.getByText(/PII sanitization/i)).toBeInTheDocument();
  });
});
