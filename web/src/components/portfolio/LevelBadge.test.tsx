import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LevelBadge from "@/components/portfolio/LevelBadge";

/**
 * Cacat #5, lapisan presentasinya.
 *
 * `parseLevel` sekarang mengembalikan `null` ketika nilai level tidak bisa
 * dipertanggungjawabkan (utils/constants.ts). Pertanyaan lanjutannya: siapa yang
 * memutuskan apa yang tampil ketika jawabannya "saya tidak tahu"?
 *
 * Jawabannya komponen ini, bukan setiap pemanggilnya. LevelBadge satu-satunya
 * komponen yang tugasnya menampilkan level, dan ketiga peta yang diindeksnya
 * sama-sama mengembalikan `undefined` untuk kunci tak dikenal:
 *   LEVEL_BADGE_CLASSES[level]  → tanpa warna
 *   LEVEL_LABELS[level]         → tanpa teks
 *   LEVEL_DESCRIPTIONS[level]   → tanpa deskripsi
 * Hasilnya kotak kosong yang tidak bisa dibedakan dari bug styling. Assessor
 * tidak punya cara untuk tahu bahwa ada rating yang gagal sampai kepadanya.
 *
 * Kenapa penjagaan tidak ditaruh di pemanggil: lihat OverridePanel.tsx:53 —
 * `existingOverride!.override_level` masuk ke badge TANPA melewati parseLevel,
 * karena tipenya memang sudah `number`. Penjagaan yang disebar ke setiap
 * pemanggil pasti bocor di tempat seperti itu, dan bocor lagi di pemanggil
 * berikutnya yang belum ditulis. Badge ini yang memvalidasi masukannya sendiri,
 * lewat penerjemah yang sama dengan semua orang.
 */
describe("LevelBadge", () => {
  it("menampilkan label dan deskripsi untuk level yang sah", () => {
    render(<LevelBadge level={3} />);
    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText("Proficient")).toBeInTheDocument();
  });

  it("menampilkan label saja pada ukuran sm", () => {
    render(<LevelBadge level={5} size="sm" />);
    expect(screen.getByText("L5")).toBeInTheDocument();
    expect(screen.queryByText("Expert")).not.toBeInTheDocument();
  });

  it("menyatakan level tidak diketahui secara eksplisit ketika null", () => {
    // Sebelum perbaikan: badge tanpa teks dan tanpa warna.
    render(<LevelBadge level={null} />);
    expect(screen.getByLabelText(/level unknown/i)).toBeInTheDocument();
  });

  it("tidak mengaku-aku level apa pun ketika nilainya tidak diketahui", () => {
    // Yang penting bukan hanya ADA tulisan, tapi tulisannya tidak berbohong.
    render(<LevelBadge level={undefined} />);
    for (const label of ["L1", "L2", "L3", "L4", "L5"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it("menolak angka di luar rentang 1..5, bukan merendernya kosong", () => {
    // `override_level` tiba dari API bertipe `number` dan TIDAK pernah lewat
    // parseLevel di OverridePanel.tsx:53. Kalau jaminan CHECK constraint
    // (schema.rb:68) bocor, badge harus mengatakannya — bukan menyembunyikannya
    // sebagai kotak kosong.
    for (const level of [0, 6, -3, 7]) {
      const { unmount } = render(<LevelBadge level={level} />);
      expect(screen.getByLabelText(/level unknown/i)).toBeInTheDocument();
      unmount();
    }
  });

  it("selalu punya isi yang terbaca, untuk masukan apa pun", () => {
    // Invarian: tidak ada satu pun masukan yang menghasilkan badge kosong.
    const inputs = [1, 2, 3, 4, 5, 0, 6, -3, 3.5, null, undefined];
    for (const input of inputs) {
      const { container, unmount } = render(<LevelBadge level={input} />);
      expect(container.textContent?.trim()).not.toBe("");
      unmount();
    }
  });
});
