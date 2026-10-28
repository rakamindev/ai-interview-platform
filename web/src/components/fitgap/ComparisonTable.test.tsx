import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import type { SkillComparison } from "@/types";

afterEach(cleanup);

// Bentuk data sama persis dengan yang dikirim backend (hasil FitGap::Engine).
// Dibuat sebagai data mentah, bukan bertipe, supaya tes menguji kontrak API yang sebenarnya.
const dataBackend = [
    { skill_label: "Skill A", skill_id: null, candidate_level: 4, expected_level: 3, result: "exceed", delta: 1, confidence: "high", is_override: true },
    { skill_label: "Skill B", skill_id: null, candidate_level: 1, expected_level: 4, result: "gap", delta: -3, confidence: "low", is_override: false },
    { skill_label: "Skill C", skill_id: null, candidate_level: null, expected_level: 2, result: "not_assessed", delta: null, confidence: null, is_override: false },
] as unknown as SkillComparison[];

function baris(label: string) {
    const tr = screen.getByText(label).closest("tr");
    if (!tr) throw new Error(`Baris untuk ${label} tidak ditemukan`);
    return within(tr);
}

describe("ComparisonTable", () => {
    it("menampilkan level yang diminta lowongan dari expected_level", () => {
        render(<ComparisonTable comparisons={dataBackend} />);

        expect(baris("Skill A").getByText("L3")).toBeTruthy();
        expect(baris("Skill B").getByText("L4")).toBeTruthy();
        expect(baris("Skill C").getByText("L2")).toBeTruthy();
    });

    it("menampilkan skill yang belum dinilai sebagai Not assessed", () => {
        render(<ComparisonTable comparisons={dataBackend} />);

        expect(baris("Skill C").getByText(/Not assessed/)).toBeTruthy();
    });

    it("ringkasan di bawah tabel menghitung skill yang belum dinilai", () => {
        render(<ComparisonTable comparisons={dataBackend} />);

        expect(screen.getByText(/Not assessed: 1 skill/)).toBeTruthy();
    });

    it("menandai override hanya pada skill yang dioverride", () => {
        render(<ComparisonTable comparisons={dataBackend} />);

        expect(baris("Skill A").getByText("✏")).toBeTruthy();
        expect(baris("Skill B").queryByText("✏")).toBeNull();
    });

    it("tidak menampilkan keterangan override kalau tidak ada yang dioverride", () => {
        const tanpaOverride = dataBackend.map((c) => ({ ...c, is_override: false }));
        const { container } = render(<ComparisonTable comparisons={tanpaOverride} />);

        expect(container.textContent).not.toContain("✏");
    });

    it("menandai level dengan confidence rendah", () => {
        render(<ComparisonTable comparisons={dataBackend} />);

        expect(baris("Skill B").getByText(/low confidence/i)).toBeTruthy();
        expect(baris("Skill A").queryByText(/low confidence/i)).toBeNull();
    });

    it("menampilkan pesan ketika tidak ada skill untuk dibandingkan", () => {
        render(<ComparisonTable comparisons={[]} />);

        expect(screen.getByText(/No skills to compare/i)).toBeTruthy();
    });
});
