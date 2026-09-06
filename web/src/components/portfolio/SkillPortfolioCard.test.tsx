import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import type { PortfolioSkill, Confidence } from "@/types";

/**
 * Instansi ketiga dari pola yang sama (SkillPortfolioCard.tsx:45):
 *   {skill.ai_confidence?.toLowerCase() === "low" && (...catatan...)}
 *
 * Di sini akibatnya berbeda dan lebih halus: ketika `ai_confidence` hilang,
 * catatan peringatan itu HILANG TANPA JEJAK. Kartu terlihat sama meyakinkan
 * dengan kartu skill yang benar-benar terverifikasi. Tidak ada yang salah di
 * layar — dan justru itu masalahnya: assessor tidak punya cara untuk tahu
 * bahwa ada informasi yang tidak sampai kepadanya.
 *
 * Diam bukan default yang aman ketika keputusannya menyangkut orang.
 */
function makeSkill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return {
    id: 7,
    skill_label: "Root Cause Analysis",
    is_discovered: false,
    // Integer 1..5 (schema.rb:115 + CHECK di :120), bukan string "L2".
    ai_level: 2,
    ai_confidence: "high",
    evidence: [],
    competency_summary: "",
    ...overrides,
  };
}

describe("SkillPortfolioCard", () => {
  it("menampilkan catatan eksplorasi singkat ketika confidence low", () => {
    render(
      <SkillPortfolioCard skill={makeSkill({ ai_confidence: "low" })} onOverrideSaved={() => {}} />
    );
    expect(screen.getByText(/only briefly explored/i)).toBeInTheDocument();
  });

  it("tidak menampilkan catatan itu ketika confidence high", () => {
    render(
      <SkillPortfolioCard skill={makeSkill({ ai_confidence: "high" })} onOverrideSaved={() => {}} />
    );
    expect(screen.queryByText(/only briefly explored/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/confidence data is missing/i)).not.toBeInTheDocument();
  });

  it("memberi tahu assessor ketika confidence tidak ada, bukan diam", () => {
    render(
      <SkillPortfolioCard
        skill={makeSkill({ ai_confidence: undefined as unknown as Confidence })}
        onOverrideSaved={() => {}}
      />
    );
    expect(screen.getByText(/confidence data is missing/i)).toBeInTheDocument();
    // Dan tetap tidak boleh mengaku-aku bahwa eksplorasinya singkat.
    expect(screen.queryByText(/only briefly explored/i)).not.toBeInTheDocument();
  });
});
