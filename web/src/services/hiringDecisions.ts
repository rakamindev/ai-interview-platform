import api from '@/services/api';

export type HiringDecisionType = 'advance' | 'hold' | 'reject';

export interface HiringDecision {
  id: number;
  decision: HiringDecisionType;
  rationale: string;
  decided_by: number;
  decided_at: string;
  ip_address?: string;
  is_immutable: true;
}

export interface HiringDecisionResponse {
  hiring_decision: HiringDecision | null;
}

export async function getHiringDecision(portfolioId: number): Promise<HiringDecision | null> {
  const res = await api.get<HiringDecisionResponse>(`/portfolios/${portfolioId}/hiring_decision`);
  return res.data.hiring_decision;
}

export async function createHiringDecision(
  portfolioId: number,
  payload: { decision: HiringDecisionType; rationale: string }
): Promise<HiringDecision> {
  const res = await api.post<HiringDecisionResponse>(
    `/portfolios/${portfolioId}/hiring_decision`,
    payload
  );
  return res.data.hiring_decision!;
}
