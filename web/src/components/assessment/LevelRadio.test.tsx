import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import LevelRadio from "@/components/assessment/LevelRadio";

/**
 * Kelanjutan cacat #5 di sisi masukan.
 *
 * Ketika `parseLevel` tidak bisa membaca level AI, OverridePanel.tsx:20 memakai
 * hasilnya sebagai nilai awal radio ini. Pertanyaannya: apa yang harus terpilih
 * kalau jawabannya "tidak diketahui"?
 *
 * Bukan L1. Bukan L3. Radio yang sudah terisi memberi tahu assessor bahwa sistem
 * punya pendapat, dan assessor yang setuju-saja akan menyimpan pendapat itu
 * sebagai penilaian MANUSIA atas seorang kandidat — padahal tidak ada yang
 * pernah menilai. Nilai awal yang jujur adalah kosong: tidak ada yang terpilih,
 * sampai ada manusia yang memilih.
 */
describe("LevelRadio", () => {
  it("menampilkan kelima pilihan L1..L5", () => {
    render(<LevelRadio value={3} onChange={() => {}} />);
    for (const label of ["L1", "L2", "L3", "L4", "L5"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("menandai pilihan yang sesuai dengan value", () => {
    render(<LevelRadio value={4} onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "L4" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "L2" })).not.toBeChecked();
  });

  it("tidak memilih apa pun ketika value tidak diketahui", () => {
    // Sebelum perbaikan: prop `value: number` memaksa pemanggil mengarang angka.
    render(<LevelRadio value={null} onChange={() => {}} />);
    for (const label of ["L1", "L2", "L3", "L4", "L5"]) {
      expect(screen.getByRole("radio", { name: label })).not.toBeChecked();
    }
  });

  it("mengirim angka, bukan string, saat dipilih", async () => {
    const onChange = vi.fn();
    render(<LevelRadio value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "L2" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
