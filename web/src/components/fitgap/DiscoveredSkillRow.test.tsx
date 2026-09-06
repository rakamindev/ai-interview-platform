import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import DiscoveredSkillRow from "@/components/fitgap/DiscoveredSkillRow";
import type { PortfolioSkill, Confidence } from "@/types";

/**
 * Cacat pasangan dari ConfidenceIndicator.
 *
 * FitGapReportPage:196 menulis:
 *   {s.ai_confidence?.toLowerCase() === "low" ? "low confidence" : "confirmed"}
 *
 * Perbandingan biner ini memaksa SEMUA nilai selain "low" menjadi "confirmed".
 * Artinya "medium" — yang menurut PRD adalah bukti sedang, belum terkonfirmasi —
 * ikut dicap "confirmed". Begitu juga nilai yang hilang. Assessor membaca
 * "confirmed" sebagai jaminan bahwa AI yakin, padahal tidak ada yang menjamin.
 *
 * Nilai yang sama tidak boleh diterjemahkan berbeda di tiga tempat berbeda.
 * Sumber kebenarannya satu: toConfidenceLabel().
 */
function makeSkill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return {
    id: 1,
    skill_label: "Incident Triage",
    is_discovered: true,
    // Integer, sesuai `t.integer "ai_level"` di schema.rb:115 — bukan "L3".
    // Factory ini sebelumnya memalsukan kontrak API: tes lulus atas payload yang
    // tidak pernah dikirim backend. Prefiks "L" adalah urusan presentasi.
    ai_level: 3,
    ai_confidence: "high",
    evidence: [],
    competency_summary: "",
    ...overrides,
  };
}

describe("DiscoveredSkillRow", () => {
  it("menampilkan skill label dan level", () => {
    render(<DiscoveredSkillRow skill={makeSkill()} />);
    expect(screen.getByText("Incident Triage")).toBeInTheDocument();
    expect(screen.getByText(/L3/)).toBeInTheDocument();
  });

  it("menyebut high confidence sebagai confirmed", () => {
    render(<DiscoveredSkillRow skill={makeSkill({ ai_confidence: "high" })} />);
    expect(screen.getByText(/confirmed/i)).toBeInTheDocument();
  });

  it("menyebut low confidence sebagai low confidence", () => {
    render(<DiscoveredSkillRow skill={makeSkill({ ai_confidence: "low" })} />);
    expect(screen.getByText(/low confidence/i)).toBeInTheDocument();
    expect(screen.queryByText(/confirmed/i)).not.toBeInTheDocument();
  });

  it("tidak boleh menyebut medium confidence sebagai confirmed", () => {
    render(<DiscoveredSkillRow skill={makeSkill({ ai_confidence: "medium" })} />);
    expect(screen.queryByText(/confirmed/i)).not.toBeInTheDocument();
    expect(screen.getByText(/medium confidence/i)).toBeInTheDocument();
  });

  it("tidak boleh menyebut confidence yang hilang sebagai confirmed", () => {
    render(
      <DiscoveredSkillRow skill={makeSkill({ ai_confidence: undefined as unknown as Confidence })} />
    );
    expect(screen.queryByText(/confirmed/i)).not.toBeInTheDocument();
    expect(screen.getByText(/confidence not available/i)).toBeInTheDocument();
  });

  it("menampilkan Unknown level — bukan undefined atau rating karangan — saat ai_level null", () => {
    // Backend kini mengirim null saat AI tidak menghasilkan level yang bisa
    // dipakai (Portfolios::LevelParser). Indexing LEVEL_LABELS langsung akan
    // merender "undefined (…)" — data hilang menyamar jadi teks.
    render(<DiscoveredSkillRow skill={makeSkill({ ai_level: null })} />);
    expect(screen.getByText(/unknown level/i)).toBeInTheDocument();
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/L1/)).not.toBeInTheDocument();
  });
});
