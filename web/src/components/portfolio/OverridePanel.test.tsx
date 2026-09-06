import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import OverridePanel from "@/components/portfolio/OverridePanel";
import type { PortfolioSkill } from "@/types";

/**
 * Ujung dari cacat #5, dan satu-satunya tempat di rantai ini yang menyentuh
 * database.
 *
 * OverridePanel.tsx:20 mengisi state dari `parseLevel(skill.ai_level)`, yang
 * sekarang bisa `null`. Nilai itu lalu mengalir ke OverridePanel.tsx:32 sebagai
 * `override_level` di payload POST /portfolio_skills/:id/override.
 *
 * Dua komponen sebelumnya (LevelBadge, LevelRadio) hanya salah MENAMPILKAN.
 * Yang ini salah MENYIMPAN. Sebuah override, menurut definisinya, adalah
 * penilaian manusia yang menimpa penilaian AI — itu sebabnya kolomnya bernama
 * `override_level` dan ada `overridden_by` di sebelahnya (schema.rb). Menyimpan
 * baris seperti itu tanpa level yang benar-benar dipilih seseorang berarti
 * menulis kesaksian atas nama assessor yang tidak pernah bersaksi.
 *
 * services/portfolios.ts:5 sudah menyatakan kontrak yang benar
 * (`override_level: number`), jadi perbaikannya bukan melonggarkan tipe service
 * itu, melainkan menolak menyimpan di UI.
 */
const { getOverrideMock } = vi.hoisted(() => ({ getOverrideMock: vi.fn() }));

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: { getOverride: getOverrideMock },
}));

function makeSkill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return {
    id: 7,
    skill_label: "Root Cause Analysis",
    is_discovered: false,
    ai_level: 3,
    ai_confidence: "high",
    evidence: [],
    competency_summary: "",
    ...overrides,
  };
}

/**
 * `ai_level` bertipe `number` di types/index.ts, jadi TypeScript tidak akan
 * pernah mengeluh soal payload yang datang tanpa field itu — tipe hilang saat
 * runtime. Cast ini bukan kecurangan tes; ini bentuk data yang dikirim server
 * ketika serializer melewatkan satu kolom, dan komponen ini tetap harus
 * bersikap benar ketika itu terjadi.
 */
const skillWithUnknownLevel = makeSkill({ ai_level: undefined as unknown as number });

async function openPanel() {
  await userEvent.click(screen.getByRole("button", { name: /override rating/i }));
}

describe("OverridePanel", () => {
  beforeEach(() => {
    getOverrideMock.mockReset();
    getOverrideMock.mockResolvedValue({
      data: { override: { id: 1, portfolio_skill_id: 7, ai_level: 3, override_level: 4, assessor_notes: "" } },
    });
  });

  it("tidak bisa menyimpan ketika tidak ada level yang dipilih", async () => {
    render(<OverridePanel skill={skillWithUnknownLevel} onSaved={() => {}} />);
    await openPanel();

    expect(screen.getByRole("button", { name: /save override/i })).toBeDisabled();
  });

  it("tidak mengirim apa pun ke server meski tombol simpan tetap ditekan", async () => {
    render(<OverridePanel skill={skillWithUnknownLevel} onSaved={() => {}} />);
    await openPanel();

    /**
     * `fireEvent`, bukan `userEvent`: yang diuji di sini justru jalur yang
     * melewati niat pengguna — event yang tetap sampai ke handler. Tombol
     * disabled adalah presentasi, dan presentasi bisa dilanggar (autofill,
     * ekstensi, tes lain, refactor CSS). Invarian "jangan simpan tanpa level"
     * harus dijaga di dalam handler-nya, bukan hanya di atribut tombolnya.
     */
    fireEvent.click(screen.getByRole("button", { name: /save override/i }));

    await new Promise((r) => setTimeout(r, 0));
    expect(getOverrideMock).not.toHaveBeenCalled();
  });

  it("memberi tahu assessor apa yang harus dilakukan, bukan hanya mematikan tombol", async () => {
    render(<OverridePanel skill={skillWithUnknownLevel} onSaved={() => {}} />);
    await openPanel();

    /**
     * Tombol mati tanpa penjelasan adalah cacat tersendiri: assessor
     * menyimpulkan aplikasinya rusak, lalu berhenti memakai fitur ini —
     * dan penilaian manusia yang seharusnya masuk tidak pernah masuk.
     */
    expect(screen.getByText(/choose a level/i)).toBeInTheDocument();
  });

  it("bisa menyimpan setelah assessor memilih level, dan mengirim angka pilihannya", async () => {
    render(<OverridePanel skill={skillWithUnknownLevel} onSaved={() => {}} />);
    await openPanel();

    await userEvent.click(screen.getByRole("radio", { name: "L4" }));
    const save = screen.getByRole("button", { name: /save override/i });
    expect(save).toBeEnabled();

    await userEvent.click(save);
    await waitFor(() =>
      expect(getOverrideMock).toHaveBeenCalledWith(7, { override_level: 4, assessor_notes: "" })
    );
  });

  it("tidak menghalangi jalur normal ketika level AI-nya valid", async () => {
    render(<OverridePanel skill={makeSkill({ ai_level: 3 })} onSaved={() => {}} />);
    await openPanel();

    expect(screen.getByRole("button", { name: /save override/i })).toBeEnabled();
    expect(screen.queryByText(/choose a level/i)).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "L3" })).toBeChecked();
  });
});
