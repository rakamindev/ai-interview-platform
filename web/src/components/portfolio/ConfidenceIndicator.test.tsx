import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ConfidenceIndicator from "@/components/portfolio/ConfidenceIndicator";

/**
 * Karakterisasi + perbaikan untuk ConfidenceIndicator.
 *
 * Kontrak dari PRD: ai_confidence hanya boleh bernilai "high" | "medium" | "low".
 * Masalahnya, getLabel() memakai `return "LOW"` sebagai fallback, jadi nilai
 * undefined / null / string tak dikenal ikut dirender sebagai "Confidence: LOW".
 *
 * Itu bukan default yang netral. "LOW" adalah pernyataan penilaian: kita bilang
 * ke assessor bahwa bukti untuk skill kandidat ini lemah. Padahal yang
 * sebenarnya terjadi adalah kita TIDAK PUNYA data confidence sama sekali.
 * Assessor bisa menolak kandidat karena label yang tidak pernah dihitung AI.
 */
describe("ConfidenceIndicator", () => {
  it("merender HIGH untuk confidence high", () => {
    render(<ConfidenceIndicator confidence="high" />);
    expect(screen.getByText(/Confidence: HIGH/i)).toBeInTheDocument();
  });

  it("merender MEDIUM untuk confidence medium", () => {
    render(<ConfidenceIndicator confidence="medium" />);
    expect(screen.getByText(/Confidence: MEDIUM/i)).toBeInTheDocument();
  });

  it("merender LOW untuk confidence low", () => {
    render(<ConfidenceIndicator confidence="low" />);
    expect(screen.getByText(/Confidence: LOW/i)).toBeInTheDocument();
  });

  it("tidak boleh mengklaim LOW ketika confidence tidak ada", () => {
    render(<ConfidenceIndicator confidence={undefined as unknown as string} />);
    expect(screen.queryByText(/Confidence: LOW/i)).not.toBeInTheDocument();
  });

  it("tidak boleh mengklaim LOW ketika confidence tidak dikenal", () => {
    render(<ConfidenceIndicator confidence="sangat-yakin" />);
    expect(screen.queryByText(/Confidence: LOW/i)).not.toBeInTheDocument();
  });
});
