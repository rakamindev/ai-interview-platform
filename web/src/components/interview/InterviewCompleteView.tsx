import { useState, useCallback } from "react";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CandidateInfo } from "@/types";
import { sessionsApi } from "@/services/sessions";

interface InterviewCompleteViewProps {
  token: string | undefined;
  candidateInfo: CandidateInfo | null;
  setCandidateInfo: React.Dispatch<React.SetStateAction<CandidateInfo | null>>;
}

export default function InterviewCompleteView({
  token,
  candidateInfo,
  setCandidateInfo,
}: InterviewCompleteViewProps) {
  const [objectionNotes, setObjectionNotes] = useState("");
  const [appealState, setAppealState] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const [appealError, setAppealError] = useState<string | null>(null);
  const [skippedAppeal, setSkippedAppeal] = useState(false);

  const handleSubmitAppeal = useCallback(async () => {
    if (!token || objectionNotes.trim().length < 10) return;
    
    setAppealState("submitting");
    try {
      await sessionsApi.submitAppeal(token, objectionNotes.trim());
      setAppealState("submitted");
      setCandidateInfo((prev) => prev ? { 
        ...prev, 
        audit_status: "objection_filed",
        candidate_objection_notes: objectionNotes.trim()
      } : null);
    } catch (e: any) {
      setAppealState("error");
      setAppealError(e.response?.data?.message || "Failed to submit appeal");
    }
  }, [token, objectionNotes, setCandidateInfo]);

  // If we transition to complete but the backend still thinks it's in_progress,
  // it means we are waiting for the final state fetch to complete (polling).
  if (candidateInfo?.session_status !== "ended") {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
        <p className="text-sm text-slate-500 font-medium animate-pulse">Finalizing interview data...</p>
      </div>
    );
  }

  const isErrorSession = candidateInfo?.end_reason === "error" && !skippedAppeal;
  const hasFiledObjection = candidateInfo?.audit_status === "objection_filed" || appealState === "submitted";
  const isResolved = candidateInfo?.audit_status === "resolved" || candidateInfo?.audit_status === "retake_approved";
  const displayedNotes = candidateInfo?.candidate_objection_notes || objectionNotes;

  return (
    <div className="max-w-xl mx-auto px-4 py-16 space-y-8">
      <div className="text-center space-y-4">
        <div className="flex justify-center text-4xl">
          {isErrorSession ? (
            <AlertCircle className="h-10 w-10 text-amber-500" />
          ) : (
            <CheckCircle className="h-10 w-10 text-emerald-500" />
          )}
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          {isErrorSession ? "Interview Disrupted" : "Interview Complete"}
        </h2>
        <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
          {isErrorSession ? (
            "We encountered an unexpected technical or network disruption during your session. Rest assured, your completed responses have been securely saved."
          ) : (
            <>
              Thank you. The interview has been recorded.
              <br />
              The hiring team will review your results and follow up with you.
            </>
          )}
        </p>
      </div>

      {isErrorSession && (
        <div className="bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-xl p-6 shadow-sm space-y-6">
          {/* Warning Banner */}
          <div className="bg-amber-50/70 border border-amber-200/50 rounded-lg p-4 text-xs text-amber-900 space-y-1.5 leading-relaxed">
            <p className="font-semibold text-amber-950 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> Technical Anomaly Detected
            </p>
            <p>
              A connectivity or system error ended this session early. You are entitled to lodge a technical appeal to request a session reset or score adjustment.
            </p>
          </div>

          {isResolved ? (
            <div className="space-y-4">
              <div className="bg-blue-50/70 border border-blue-200/50 rounded-lg p-4 text-xs text-blue-900 space-y-2">
                <p className="font-semibold text-blue-950 flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5" /> Technical Objection Resolved
                </p>
                <p className="leading-relaxed">
                  The hiring team has reviewed your session and made a final decision regarding your technical appeal.
                </p>
                {candidateInfo?.audit_status === "retake_approved" && (
                  <p className="font-medium mt-1">Status: Retake Approved. Please check your email for a new invitation link.</p>
                )}
                {candidateInfo?.audit_status === "resolved" && (
                  <p className="font-medium mt-1">Status: Manually Scored based on partial answers.</p>
                )}
              </div>
            </div>
          ) : hasFiledObjection ? (
            <div className="space-y-4">
              <div className="bg-emerald-50/70 border border-emerald-200/50 rounded-lg p-4 text-xs text-emerald-900 space-y-2">
                <p className="font-semibold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5" /> Technical Objection Filed
                </p>
                <p className="italic bg-white/50 border border-emerald-100 p-2.5 rounded font-mono text-slate-700 text-[11px] leading-relaxed break-words">
                  "{displayedNotes}"
                </p>
              </div>

              {/* SLA badging */}
              <div className="flex items-center justify-between p-3.5 bg-rose-50/60 border border-rose-100 rounded-lg text-xs animate-pulse">
                <div className="space-y-0.5">
                  <span className="font-semibold text-rose-950">Active SLA Urgency</span>
                  <p className="text-[10px] text-rose-800">Under review by organization security staff</p>
                </div>
                <span className="px-2.5 py-1 bg-rose-600 text-white font-semibold rounded-full text-[9px] uppercase tracking-wider">
                  Urgent (&lt;12 Hours)
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="objection-input" className="block text-xs font-semibold text-slate-700">
                  Explain the technical issue you faced:
                </label>
                <textarea
                  id="objection-input"
                  className="w-full min-h-[100px] text-xs p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-slate-50/30 font-sans"
                  placeholder="e.g. My network connection dropped for 2 minutes and I couldn't finish the last question..."
                  value={objectionNotes}
                  onChange={(e) => setObjectionNotes(e.target.value)}
                  disabled={appealState === "submitting"}
                />
                <div className="flex items-center justify-between text-[10px]">
                  <span className={objectionNotes.trim().length >= 10 ? "text-emerald-600 font-medium" : "text-slate-400"}>
                    {objectionNotes.trim().length} / 10 characters minimum
                  </span>
                </div>
              </div>

              {appealState === "error" && appealError && (
                <p className="text-xs text-rose-600 font-medium bg-rose-50 border border-rose-100 rounded-md p-2">
                  {appealError}
                </p>
              )}

              <div className="space-y-2 pt-2">
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors text-xs py-2.5 h-auto"
                  onClick={handleSubmitAppeal}
                  disabled={objectionNotes.trim().length < 10 || appealState === "submitting"}
                >
                  {appealState === "submitting" ? "Submitting Appeal..." : "Submit Technical Appeal"}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-slate-500 hover:text-slate-700 text-xs py-2 h-auto font-medium"
                  onClick={() => setSkippedAppeal(true)}
                  disabled={appealState === "submitting"}
                >
                  Skip appeal and finish interview
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
