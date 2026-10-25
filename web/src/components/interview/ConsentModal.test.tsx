import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ConsentModal from "./ConsentModal";
import { sessionsApi } from "@/services/sessions";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    submitConsent: vi.fn().mockResolvedValue({
      data: { consented: true, consented_at: "2026-10-25T12:00:00Z", terms_version: "2026.1" },
    }),
  },
}));

describe("ConsentModal (UU PDP No. 27/2022 Gate)", () => {
  it("renders bilingual legal disclosures and language switcher", () => {
    const onConsentSuccess = vi.fn();
    render(<ConsentModal token="test-token" roleTitle="Backend Lead" onConsentSuccess={onConsentSuccess} />);

    // Default language is Bahasa Indonesia
    expect(screen.getByText("Persetujuan Pemrosesan Data Pribadi & Rekaman Suara")).toBeInTheDocument();
    expect(screen.getByText("Versi Kebijakan: 2026.1")).toBeInTheDocument();

    // Switch to English
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByText("Personal Data Processing & Audio Recording Consent")).toBeInTheDocument();
    expect(screen.getByText("Policy Version: 2026.1")).toBeInTheDocument();
  });

  it("disables submit button until all 3 checkboxes are explicitly checked", async () => {
    const onConsentSuccess = vi.fn();
    render(<ConsentModal token="test-token" onConsentSuccess={onConsentSuccess} />);

    const submitBtn = screen.getByRole("button", { name: /Lanjutkan ke Pemeriksaan Perangkat/i });
    expect(submitBtn).toBeDisabled();

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(3);

    // Check first two
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(submitBtn).toBeDisabled();

    // Check third
    fireEvent.click(checkboxes[2]);
    expect(submitBtn).not.toBeDisabled();

    // Submit form
    fireEvent.click(submitBtn);

    expect(sessionsApi.submitConsent).toHaveBeenCalledWith("test-token", { terms_version: "2026.1" });
  });
});
