import api from "./api";
import type { CandidateSession } from "@/types";

/**
 * Candidate-facing calls. These are authenticated with the candidate's own JWT
 * (role "user"), and the API scopes every result to that account — a candidate
 * can only ever see and act on their own interviews.
 */
export const candidateApi = {
  mySessions: () => api.get<{ sessions: CandidateSession[] }>("/candidate/sessions"),
};
