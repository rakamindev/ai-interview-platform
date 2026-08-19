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

export type PortfolioSkillStatus = "rated" | "not_assessed";

export interface PortfolioSkill {
  id: number;
  skill_id?: number;
  skill_label: string;
  is_discovered: boolean;
  status: PortfolioSkillStatus;
  ai_level: string | null;
  ai_confidence: string | null;
  evidence: string[];
  competency_summary: string | null;
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
