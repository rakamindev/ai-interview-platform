export const TIME_LIMIT_OPTIONS = [10, 30, 45, 60, 90] as const;

/**
 * Menerjemahkan nilai level yang tiba dari API menjadi integer 1..5 — atau
 * `null` kalau nilainya tidak bisa dipertanggungjawabkan.
 *
 * Kontrak yang dijaga fungsi ini:
 *   api/db/schema.rb:115                  t.integer "ai_level", null: false
 *   api/db/schema.rb:120                  CHECK (ai_level >= 1 AND ai_level <= 5)
 *   api/app/models/portfolio_skill.rb:10  numericality: { only_integer: true, in: 1..5 }
 *
 * Versi sebelumnya berbunyi `return isNaN(n) ? 1 : n`. Artinya kegagalan membaca
 * data dibalas dengan L1 — dan L1 bukan nilai netral: menurut LEVEL_DESCRIPTIONS
 * itu "Foundational", rating kompetensi TERENDAH yang bisa diberikan sistem ini
 * kepada seorang kandidat. Kandidat itu tidak pernah memilih untuk berada di
 * dalam kegagalan tersebut, dan tidak akan pernah tahu bahwa itu terjadi.
 *
 * Cabang `typeof level === "number"` juga meneruskan angka apa pun tanpa
 * pemeriksaan: 0, -3, 7, 3.5 semuanya lolos, lalu dipakai mengindeks
 * LEVEL_LABELS dan menghasilkan `undefined` — badge kosong tanpa penjelasan.
 * Sejak `ai_level` dibetulkan menjadi `number` (types/index.ts), justru cabang
 * inilah yang dilewati seluruh lalu lintas nyata.
 *
 * `null` berarti "saya tidak tahu", dan memaksa pemanggil memutuskan secara
 * sadar apa yang ditampilkan. Pola `!= null` ini sudah dipakai di
 * ComparisonTable.tsx:53 untuk `candidate_level`, jadi bukan konvensi baru.
 *
 * Parameter tetap menerima `string | null | undefined` walaupun tipe kontraknya
 * `number`, karena tipe TypeScript hilang saat runtime dan tidak memvalidasi
 * satu byte pun dari payload JSON yang benar-benar tiba.
 */
export function parseLevel(level: string | number | null | undefined): number | null {
  if (level === null || level === undefined) return null;

  const n = typeof level === "number" ? level : parseInt(level.replace(/\D/g, ""), 10);

  if (!Number.isInteger(n)) return null;
  if (n < 1 || n > 5) return null;

  return n;
}

export const LEVEL_LABELS: Record<number, string> = {
  1: "L1",
  2: "L2",
  3: "L3",
  4: "L4",
  5: "L5",
};

export const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: "Foundational",
  2: "Functional",
  3: "Proficient",
  4: "Advanced",
  5: "Expert",
};

// L-badge colors (Tailwind classes)
export const LEVEL_BADGE_CLASSES: Record<number, string> = {
  1: "bg-neutral-200 text-neutral-700",
  2: "bg-blue-100 text-blue-700",
  3: "bg-teal-100 text-teal-700",
  4: "bg-purple-100 text-purple-700",
  5: "bg-yellow-100 text-yellow-700",
};

// Coverage state display
export const COVERAGE_STATE_LABELS: Record<string, string> = {
  not_yet: "not yet",
  initiated: "initiated",
  partial: "partial",
  covered: "covered",
};

export const COVERAGE_STATE_WIDTH: Record<string, number> = {
  not_yet: 0,
  initiated: 25,
  partial: 60,
  covered: 100,
};

export const COVERAGE_STATE_COLOR: Record<string, string> = {
  not_yet: "bg-neutral-200",
  initiated: "bg-blue-300",
  partial: "bg-teal-400",
  covered: "bg-teal-600",
};

// Fit/Gap result display
export const FIT_GAP_RESULT_LABELS: Record<string, string> = {
  match: "Match",
  gap: "Gap",
  exceed: "Exceeds",
  not_assessed: "Not assessed",
};

export const FIT_GAP_RESULT_CLASSES: Record<string, string> = {
  match: "text-green-700 bg-green-50",
  gap: "text-amber-700 bg-amber-50",
  exceed: "text-green-700 bg-green-50",
  not_assessed: "text-neutral-500 bg-neutral-50",
};
