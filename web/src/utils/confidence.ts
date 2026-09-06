/**
 * Satu-satunya tempat nilai `ai_confidence` diterjemahkan menjadi teks.
 *
 * Sebelum ini, nilai yang sama diinterpretasikan di tiga tempat berbeda dengan
 * tiga hasil berbeda:
 *   - ConfidenceIndicator.tsx    → fallback `return "LOW"`
 *   - FitGapReportPage.tsx:196   → `=== "low" ? "low confidence" : "confirmed"`
 *   - SkillPortfolioCard.tsx:45  → `=== "low" &&` untuk memunculkan catatan
 *
 * Akibatnya "medium" dibaca sebagai "confirmed" di satu layar, dan nilai yang
 * hilang dibaca sebagai "LOW" di layar lain. Assessor memutuskan nasib kandidat
 * dari layar-layar itu, jadi ketiganya harus membaca satu fungsi yang sama.
 *
 * Sumber kontrak:
 *   api/app/models/portfolio_skill.rb:4  CONFIDENCE_LEVELS = %w[high medium low]
 *   api/db/schema.rb:116                 enum confidence_level, null: false
 */

/** Nilai sah menurut enum `confidence_level` di database. */
export type Confidence = "high" | "medium" | "low";

/**
 * UNKNOWN bukan level keempat. Itu penanda bahwa datanya tidak ada atau tidak
 * dikenal — kondisi yang harus dibedakan dari "buktinya lemah".
 */
export type ConfidenceLabel = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export function toConfidenceLabel(value: string | null | undefined): ConfidenceLabel {
  switch (value?.trim().toLowerCase()) {
    case "high":
      return "HIGH";
    case "medium":
      return "MEDIUM";
    case "low":
      return "LOW";
    default:
      // Sengaja BUKAN "LOW". Menyebut LOW untuk data yang tidak ada berarti
      // kita mengarang penilaian atas kandidat yang tidak pernah dihitung AI.
      return "UNKNOWN";
  }
}

/**
 * Frasa inline untuk dipakai di dalam kalimat, mis. "L3 (medium confidence)".
 *
 * Hanya HIGH yang boleh disebut "confirmed". MEDIUM tidak terkonfirmasi — itu
 * justru sinyal supaya assessor menggali lagi, dan menyembunyikannya di balik
 * kata "confirmed" menghapus sinyal tersebut.
 */
export function toConfidencePhrase(value: string | null | undefined): string {
  switch (toConfidenceLabel(value)) {
    case "HIGH":
      return "confirmed";
    case "MEDIUM":
      return "medium confidence";
    case "LOW":
      return "low confidence";
    default:
      return "confidence not available";
  }
}

/**
 * Untuk UI yang hanya perlu tahu "apakah ini perlu digali ulang".
 * Nilai yang hilang TIDAK dianggap low — pemanggil wajib menangani UNKNOWN
 * secara terpisah kalau memang mau menampilkan sesuatu.
 */
export function isLowConfidence(value: string | null | undefined): boolean {
  return toConfidenceLabel(value) === "LOW";
}

export function isConfidenceKnown(value: string | null | undefined): boolean {
  return toConfidenceLabel(value) !== "UNKNOWN";
}
