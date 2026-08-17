import { AlertTriangle, CheckCircle, RotateCcw } from "lucide-react";
import type { Session } from "@/types";

export default function SystemHealthPanel({ session }: { session: Session }) {
  if (session.end_reason !== "error") return null;

  if (session.audit_status === "retake_approved") {
    return (
      <div className="bg-white border border-blue-200 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="mt-0.5">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <RotateCcw className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-1.5 pt-0.5">
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                Retake Approved
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
                A new session has been created for the candidate. The partial results below are from this disrupted session and have been superseded by the new retake session.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (session.audit_status === "resolved") {
    return (
      <div className="bg-white border border-emerald-200 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="mt-0.5">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-1.5 pt-0.5">
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                Objection Resolved
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
                This session was disrupted, but the issue has been manually reviewed and resolved. The scores below are based on partial answers and are considered final.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If there is an active objection, ResolveObjectionPanel will handle the display
  if (session.audit_status === "objection_filed") {
    return null;
  }

  return (
    <div className="relative bg-white border border-amber-200 rounded-xl shadow-sm overflow-hidden mb-6">
      <div className="absolute -right-6 -top-6 text-amber-500/10 rotate-12 pointer-events-none">
        <AlertTriangle className="w-32 h-32" />
      </div>
      <div className="relative p-5">
        <div className="flex items-start gap-4">
          <div className="mt-0.5">
            <div className="p-2 bg-amber-100/50 rounded-lg text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="space-y-1.5 pt-0.5">
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
              System Health Warning
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
              This session was terminated early due to a technical anomaly (e.g. network timeout or browser crash).
              Some skills may be marked as <code className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100 mx-1">System Error</code> rather than assessed.
              This reflects a system failure, not candidate performance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
