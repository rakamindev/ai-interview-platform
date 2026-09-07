import api from "./api";

export interface HiringDecision {
  id: number;
  portfolio_id: number;
  decision: "advance" | "hold" | "reject";
  rationale: string;
  levels_at_decision: Record<
    string,
    {
      ai_level: number | null;
      effective_level: number | null;
      confidence: string | null;
      overridden: boolean;
      is_discovered: boolean;
      assessed: boolean;
    }
  >;
  decided_by: number;
  decided_at: string;
}

export const hiringDecisionsApi = {
  get: (portfolioId: number) =>
    api.get<{ hiring_decision: HiringDecision | null }>(
      `/portfolios/${portfolioId}/hiring_decision`
    ),

  create: (portfolioId: number, decision: string, rationale: string) =>
    api.post<{ hiring_decision: HiringDecision }>(
      `/portfolios/${portfolioId}/hiring_decision`,
      { hiring_decision: { decision, rationale } }
    ),
};
