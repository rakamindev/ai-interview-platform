import axios from "axios";
import api from "./api";
import type { CandidateFeedback } from "@/types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

export interface SubmitFeedbackPayload {
  rating: number;
  experience_tag?: string;
  feedback_text?: string;
  has_complaint: boolean;
  complaint_text?: string;
}

export const feedbackApi = {
  // Candidate-facing: uses plain axios without auth token to avoid redirect on 401/403
  submit: (token: string, data: SubmitFeedbackPayload) =>
    axios.post<{ data: { feedback: CandidateFeedback } }>(
      `${BASE_URL}/sessions/${token}/feedback`,
      { feedback: data },
      { headers: { "Content-Type": "application/json" } }
    ),

  // Admin/assessor-facing: uses authenticated api instance
  getBySession: (sessionId: number) =>
    api.get<{ feedback: CandidateFeedback | null }>(`/sessions/${sessionId}/feedback`),
};

