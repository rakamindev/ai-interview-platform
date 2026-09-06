// web/src/services/candidateConsent.ts
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1';

export interface CandidateConsentInfo {
  organization_name: string;
  assessment_name: string;
  consent_required: boolean;
  has_consent: boolean;
  disclosure_version: string;
  data_collected: string[];
  retention_period: string;
  candidate_rights: string[];
  contact_email: string;
}

export type CandidateInfo = CandidateConsentInfo;

export async function getCandidateInfo(token: string): Promise<CandidateConsentInfo> {
  const res = await axios.get<CandidateConsentInfo>(`${BASE_URL}/candidate/${token}`);
  return res.data;
}

export async function grantConsent(token: string): Promise<{ status: string; message: string }> {
  const res = await axios.post(`${BASE_URL}/candidate/${token}/consent`);
  return res.data;
}
