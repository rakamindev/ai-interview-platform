import { AlertTriangle, CheckCircle, RotateCcw } from "lucide-react";
import type { Session } from "@/types";

export default function SystemHealthPanel({ session }: { session: Session }) {
  if (session.end_reason !== "error") return null;

  if (session.audit_status === "retake_approved") {
    return (
      <div className="bg-blue-50/80 backdrop-blur-md border border-blue-200/60 rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex items-start gap-3">
          <RotateCcw className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-blue-900">
              Retake Approved
            </h3>
            <p className="text-sm text-blue-800 leading-relaxed">
              A new session has been created for the candidate. The partial results below are from this disrupted session and have been superseded by the new retake session.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (session.audit_status === "resolved") {
    return (
      <div className="bg-emerald-50/80 backdrop-blur-md border border-emerald-200/60 rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-emerald-900">
              Objection Resolved
            </h3>
            <p className="text-sm text-emerald-800 leading-relaxed">
              This session was disrupted, but the issue has been manually reviewed and resolved. The scores below are based on partial answers and are considered final.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50/80 backdrop-blur-md border border-amber-200/60 rounded-xl p-4 mb-6 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-amber-900">
            System Health Warning
          </h3>
          <p className="text-sm text-amber-800 leading-relaxed">
            This session was terminated early due to a technical anomaly (e.g. network timeout or browser crash).
            Some skills may be marked as <span className="font-semibold px-1.5 py-0.5 bg-amber-200/50 rounded">System Error</span> rather than assessed. 
            This reflects a system failure, not candidate performance.
          </p>
        </div>
      </div>
    </div>
  );
}
