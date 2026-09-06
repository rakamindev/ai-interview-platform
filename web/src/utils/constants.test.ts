import { describe, it, expect } from "vitest";
import { parseLevel, LEVEL_LABELS } from "@/utils/constants";

/**
 * Cacat #5 — keluarga yang sama dengan ConfidenceIndicator, tapi taruhannya lebih besar.
 *
 * `parseLevel` versi awal:
 *   export function parseLevel(level: string | number): number {
 *     if (typeof level === "number") return level;
 *     const n = parseInt(level.replace(/\D/g, ""), 10);
 *     return isNaN(n) ? 1 : n;
 *   }
 *
 * Dua lubang di sana:
 *
 * 1. `isNaN(n) ? 1` — nilai yang TIDAK TERBACA diubah menjadi L1. L1 bukan nilai
 *    netral; menurut LEVEL_DESCRIPTIONS itu "Foundational", rating kompetensi
 *    TERENDAH yang bisa diberikan sistem ini kepada seorang kandidat. Jadi
 *    kegagalan membaca data dibayar oleh orang yang tidak pernah memilih untuk
 *    ada di dalam kegagalan itu.
 *
 * 2. Cabang `typeof level === "number"` meneruskan angka APA PUN tanpa validasi:
 *    0, -3, 7, dan 3.5 semuanya lolos. Sejak `ai_level` diperbaiki menjadi
 *    `number` (lihat types/index.ts), justru cabang inilah yang dilewati SEMUA
 *    lalu lintas nyata — jadi jalur yang paling sering dipakai adalah jalur yang
 *    paling tidak dijaga. Nilai di luar 1..5 lalu dipakai untuk mengindeks
 *    LEVEL_LABELS dan menghasilkan `undefined`: badge kosong tanpa penjelasan.
 *
 * Perbaikannya bukan mengganti angka tebakan dengan angka tebakan lain,
 * melainkan mengembalikan `null` — "saya tidak tahu" — dan memaksa pemanggil
 * memutuskan secara sadar apa yang ditampilkan. Pola `!= null` ini sudah dipakai
 * di ComparisonTable.tsx:53 untuk `candidate_level`, jadi ini bukan konvensi baru.
 *
 * Catatan desain: `parseLevel` sengaja TIDAK dipindah ke modul sendiri seperti
 * `toConfidenceLabel` → `utils/confidence.ts`. Modul itu lahir untuk menyatukan
 * tiga implementasi yang sudah menyimpang. `parseLevel` sudah satu-satunya
 * penerjemah level; cacatnya ada di nilai baliknya, bukan di lokasinya.
 * Memindahkannya hanya akan menambah gerakan tanpa menambah kebenaran.
 */
describe("parseLevel", () => {
  it("meneruskan integer 1..5 apa adanya", () => {
    expect(parseLevel(1)).toBe(1);
    expect(parseLevel(3)).toBe(3);
    expect(parseLevel(5)).toBe(5);
  });

  it("masih menerima format presentasi \"L3\" sebagai toleransi runtime", () => {
    // Kontrak API mengirim integer, tapi tipe TypeScript hilang saat runtime.
    // Bentuk "L3" tetap diterima supaya payload lama/tak terduga tidak
    // menghasilkan badge kosong.
    expect(parseLevel("L3")).toBe(3);
    expect(parseLevel("3")).toBe(3);
  });

  it("TIDAK BOLEH mengubah nilai tak terbaca menjadi L1", () => {
    // Inti cacatnya. Sebelum perbaikan, ketiga ekspektasi ini mengembalikan 1.
    expect(parseLevel("belum dinilai")).not.toBe(1);
    expect(parseLevel("")).not.toBe(1);
    expect(parseLevel("L")).not.toBe(1);
  });

  it("mengembalikan null untuk string tanpa angka yang bisa dibaca", () => {
    expect(parseLevel("belum dinilai")).toBeNull();
    expect(parseLevel("")).toBeNull();
    expect(parseLevel("L")).toBeNull();
  });

  it("mengembalikan null untuk null dan undefined", () => {
    // Kolomnya NOT NULL di schema.rb:115, tapi tipe frontend tidak memvalidasi
    // payload yang benar-benar tiba. Batas ini harus menjaga dirinya sendiri.
    expect(parseLevel(null)).toBeNull();
    expect(parseLevel(undefined)).toBeNull();
  });

  it("mengembalikan null untuk angka di luar rentang 1..5", () => {
    // CHECK constraint di schema.rb:120 menjamin 1..5. Kalau yang tiba di luar
    // itu, jaminannya sudah bocor di suatu tempat — dan menampilkan L7 sebagai
    // badge kosong menyembunyikan kebocoran itu.
    expect(parseLevel(0)).toBeNull();
    expect(parseLevel(6)).toBeNull();
    expect(parseLevel(-3)).toBeNull();
    expect(parseLevel("L7")).toBeNull();
  });

  it("mengembalikan null untuk angka non-integer", () => {
    // portfolio_skill.rb:10 — numericality: { only_integer: true, in: 1..5 }
    expect(parseLevel(3.5)).toBeNull();
    expect(parseLevel(NaN)).toBeNull();
    expect(parseLevel(Infinity)).toBeNull();
  });

  it("setiap nilai balik non-null selalu punya label di LEVEL_LABELS", () => {
    // Invarian yang mengikat parser ke lapisan presentasinya: kalau parseLevel
    // meloloskan sebuah nilai, LEVEL_LABELS harus bisa menamainya. Inilah yang
    // dilanggar oleh cabang passthrough tanpa validasi.
    const inputs = [1, 2, 3, 4, 5, 0, 6, -3, 3.5, "L3", "L7", "", null, undefined];
    for (const input of inputs) {
      const level = parseLevel(input as never);
      if (level !== null) {
        expect(LEVEL_LABELS[level]).toBeDefined();
      }
    }
  });
});
