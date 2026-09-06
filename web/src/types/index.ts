import type { Confidence } from "@/utils/confidence";

/**
 * Rumah kanonik `Confidence` ada di `@/utils/confidence` — bersama fungsi yang
 * menerjemahkannya. Di-re-export di sini supaya konsumen tipe tidak perlu tahu
 * dua lokasi, tapi definisinya tetap satu.
 */
export type { Confidence };

export interface Assessment {
  id: number;
  name: string;
  time_limit_min: number;
  language?: "en" | "id";
  system_prompt?: string;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  skills?: AssessmentSkill[];
  latest_session?: {
    status: "pending" | "active" | "ended";
    end_reason?: string | null;
  };
}

export interface AssessmentSkill {
  id?: number;
  skill_id?: number;
  skill_label: string;
  is_custom: boolean;
  expected_level: number;
  display_order: number;
  scope_include?: string;
  scope_exclude?: string;
  l1_anchor?: string;
  l2_anchor?: string;
  l3_anchor?: string;
  l4_anchor?: string;
  l5_anchor?: string;
  _destroy?: boolean;
}

export interface Session {
  id: number;
  assessment_id: number;
  tenant_id?: number;
  candidate_id?: number;
  candidate_name?: string;
  invite_token: string;
  invite_url: string;
  status: "pending" | "active" | "ended";
  end_reason?: string;
  started_at?: string;
  ended_at?: string;
  duration_seconds?: number;
  created_at?: string;
}

export interface CoverageSkill {
  id: number;
  skill_id: number;
  skill_label: string;
  is_discovered: boolean;
  state: "not_yet" | "initiated" | "partial" | "covered";
  probe_count: number;
  last_signal?: string;
  updated_at?: string;
}

export interface CoverageMap {
  skills: CoverageSkill[];
  discovered: CoverageSkill[];
  updated_at?: string;
}

export interface TranscriptTurn {
  id: number;
  turn_number: number;
  speaker: "candidate" | "ai" | "assessor" | "system";
  text: string;
  audio_start_ms?: number;
  audio_end_ms?: number;
  created_at: string;
}

export interface Portfolio {
  id: number;
  session_id: number;
  candidate_id?: number;
  generation_status: "pending" | "generating" | "complete" | "failed";
  generated_at?: string;
  generation_error?: string;
  skills: PortfolioSkill[];
  overrides: AssessorOverride[];
}

export interface PortfolioSkill {
  id: number;
  skill_id?: number;
  skill_label: string;
  is_discovered: boolean;
  /**
   * Integer 1..5, BUKAN string "L1" — atau `null` saat AI tidak pernah
   * menghasilkan level yang bisa dipakai.
   *
   * Kontraknya bisa dibaca hitam-putih:
   *   api/db/schema.rb                       t.integer "ai_level" — nullable sejak
   *                                          migrasi relax_portfolio_skills_ai_level
   *   api/db/schema.rb                       CHECK (ai_level IS NULL OR (ai_level >= 1 AND ai_level <= 5))
   *   api/app/models/portfolio_skill.rb      numericality: { only_integer: true, in: 1..5, allow_nil: true }
   *   api/app/services/portfolios/level_parser.rb  level hilang/rusak → nil, BUKAN L1
   *   api/app/controllers/.../portfolios_controller.rb  ai_level: skill.ai_level
   *
   * Serializer meneruskan Integer atau null apa adanya. `null` = "belum dinilai"
   * dan HARUS tampil sebagai ketiadaan (parseLevel → null, LevelBadge "Unknown") —
   * bukan sebagai rating terendah. Prefiks "L" adalah bahasa presentasi
   * (LEVEL_LABELS), bukan bahasa API.
   */
  ai_level: number | null;
  /**
   * Enum database, sudah dijamin NOT NULL di level tabel:
   *   api/db/schema.rb:116                  t.enum "ai_confidence", null: false
   *   api/app/models/portfolio_skill.rb:11  inclusion: { in: %w[high medium low] }
   *
   * Tipe ini menyatakan JANJI kontrak. Komponen tetap menerima
   * `string | null | undefined` karena tipe TypeScript hilang saat runtime dan
   * tidak memvalidasi apa pun atas payload JSON yang benar-benar tiba.
   */
  ai_confidence: Confidence;
  evidence: string[];
  competency_summary: string;
}

export interface AssessorOverride {
  id: number;
  portfolio_skill_id: number;
  ai_level: number;
  override_level: number;
  assessor_notes: string;
  overridden_by?: number;
  overridden_at?: string;
}

export interface Vacancy {
  id: number;
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  skills: VacancySkill[];
}

export interface VacancySkill {
  id?: number;
  skill_id?: number;
  skill_label: string;
  expected_level: number;
  _destroy?: boolean;
}

export type SkillComparisonResult = "match" | "gap" | "exceed" | "not_assessed";

export interface SkillComparison {
  skill_label: string;
  required_level: number;
  candidate_level?: number;
  result: SkillComparisonResult;
  delta?: number;
  is_override?: boolean;
}

export interface FitGapReport {
  id: number;
  portfolio_id: number;
  vacancy_id: number;
  skill_comparisons: SkillComparison[];
  culture_narrative: string;
  overall_narrative: string;
  generated_at: string;
}

export interface SkillTaxonomy {
  skill_id: string;
  skill_label: string;
  category: string;
  scope_include: string;
  scope_exclude: string;
  l1_anchor: string;
  l2_anchor: string;
  l3_anchor: string;
  l4_anchor: string;
  l5_anchor: string;
}

export interface CandidateInfo {
  session_id: number;
  role_title: string;
  time_limit_min: number;
  session_status: string;
}

export interface PaginationMeta {
  current_page: number;
  total_pages: number;
  total_count: number;
  per_page: number;
}

// WebSocket message types
export type InterviewState =
  | "idle"
  | "hardware_check"
  | "connecting"
  | "active"
  | "reconnecting"
  | "draining_audio"
  | "ending"
  | "complete"
  /**
   * Cacat #7. Sebelum ini union-nya tidak punya satu pun anggota yang berarti
   * "gagal", sehingga `InterviewPage.tsx:51` memakai `complete` untuk semua
   * kelas kegagalan — dan `complete` adalah state yang layarnya mengucapkan
   * terima kasih. Tipe yang tidak menyediakan cara mengatakan "gagal" akan
   * dipenuhi dengan kebohongan yang paling mudah diucapkan.
   *
   * Dipisah dua, bukan satu, karena pemulihannya berbeda:
   * - `error`: wawancara belum/tidak bisa berjalan (token kedaluwarsa,
   *   assessment hilang, API mati, atau error server yang tidak bisa
   *   dipulihkan). Tindakan yang masuk akal: tanya ulang ke server.
   * - `connection_lost`: wawancara sedang berjalan lalu sambungannya habis
   *   setelah semua percobaan reconnect gagal. Tindakan yang masuk akal:
   *   sambungkan ulang, bukan mulai dari nol.
   *
   * Menyatukan keduanya berarti mengulangi kesalahan yang sama dalam skala
   * lebih kecil: meruntuhkan dua keadaan berbeda ke satu layar.
   */
  | "error"
  | "connection_lost";

export type InterviewSpeaker = "ai" | "candidate" | null;

export interface WsControlMessage {
  type:
    | "session_started"
    | "session_ended"
    | "transcript"
    | "transcription"
    | "reconnecting"
    | "reconnected"
    | "speaker_changed"
    | "preparing_to_end"
    | "error";
  speaker?: "candidate" | "ai";
  role?: "candidate" | "ai";
  text?: string;
  reason?: string;
  code?: string;
  message?: string;
  recoverable?: boolean;
}
