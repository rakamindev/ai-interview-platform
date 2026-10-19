import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import CandidatePDPNotice from "./CandidatePDPNotice";

describe("CandidatePDPNotice Component (UU PDP No. 27/2022)", () => {
  it("renders statutory UU PDP compliance elements and legal context", () => {
    const handleConsentChange = vi.fn();
    render(<CandidatePDPNotice consented={false} onConsentChange={handleConsentChange} />);

    expect(
      screen.getByText(/Persetujuan Pemrosesan Data Pribadi \(UU PDP No\. 27\/2022\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Rekaman Suara & Biometrik/i)).toBeInTheDocument();
    expect(screen.getByText(/Pengawasan Manusia \(Human-in-Loop\)/i)).toBeInTheDocument();
  });

  it("expands full policy details upon clicking toggle", () => {
    const handleConsentChange = vi.fn();
    render(<CandidatePDPNotice consented={false} onConsentChange={handleConsentChange} />);

    const toggleButton = screen.getByText(/Lihat ketentuan lengkap UU PDP No\. 27\/2022/i);
    fireEvent.click(toggleButton);

    expect(
      screen.getByText(/Rincian Kebijakan Privasi Sesuai UU No\. 27 Tahun 2022/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Non-Komersialisasi:/i)).toBeInTheDocument();
  });

  it("calls onConsentChange with true when checkbox is checked", () => {
    const handleConsentChange = vi.fn();
    render(<CandidatePDPNotice consented={false} onConsentChange={handleConsentChange} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(handleConsentChange).toHaveBeenCalledWith(true);
  });
});
