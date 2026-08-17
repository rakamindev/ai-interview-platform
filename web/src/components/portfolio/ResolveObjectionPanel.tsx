import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Copy, Check } from "lucide-react";
import { useResolveObjection } from "@/hooks/useResolveObjection";
import type { Session } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ResolveObjectionPanelProps {
  session: Session;
  onResolved: (updatedSession: Session) => void;
}

export default function ResolveObjectionPanel({
  session,
  onResolved,
}: ResolveObjectionPanelProps) {
  const {
    resolveState,
    retakeState,
    errorMsg,
    newInviteUrl,
    resolveObjection,
    approveRetake,
    resetState,
  } = useResolveObjection();

  const [activeModal, setActiveModal] = useState<"none" | "resolve" | "retake">("none");
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const [updatedSessionData, setUpdatedSessionData] = useState<Session | null>(null);

  const handleOpenModal = (modal: "resolve" | "retake") => {
    resetState();
    setNotes("");
    setCopied(false);
    setUpdatedSessionData(null);
    setActiveModal(modal);
  };

  const handleCloseModal = () => {
    if (resolveState === "submitting" || retakeState === "submitting") return;
    setActiveModal("none");
    if (updatedSessionData) {
      onResolved(updatedSessionData);
    }
  };

  const onConfirmResolve = () => {
    resolveObjection(session.id, notes, (updatedSession) => {
      setUpdatedSessionData(updatedSession);
      setTimeout(() => {
        setActiveModal("none");
        onResolved(updatedSession);
      }, 1500);
    });
  };

  const onConfirmRetake = () => {
    approveRetake(session.id, (updatedSession) => {
      setUpdatedSessionData(updatedSession);
    });
  };

  const handleCopyLink = () => {
    if (newInviteUrl) {
      navigator.clipboard.writeText(newInviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (session.audit_status !== "objection_filed") return null;

  return (
    <>
      <div className="bg-white border border-amber-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5">
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                <h3 className="text-sm font-semibold text-slate-900 tracking-tight">Technical Objection Filed</h3>
                <span className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-medium uppercase rounded-md tracking-wider">
                  Needs Review • SLA 48H
                </span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                The candidate reported a technical or network issue: 
                <span className="font-mono text-xs bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded mx-1.5 border border-slate-200">"{session.candidate_objection_notes}"</span>
              </p>
              {session.end_reason === "error" && (
                <p className="text-xs text-amber-700 mt-2 bg-amber-50/50 p-2 rounded-md border border-amber-100/50">
                  <strong className="font-medium text-amber-900">Note:</strong> The system logs confirm an abnormal termination (e.g., network timeout) occurred. Any skills marked as <code className="text-[10px] bg-white text-amber-700 px-1 py-0.5 rounded border border-amber-200 mx-0.5">system_error</code> reflect this failure, not candidate performance.
                </p>
              )}
            </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  <strong className="text-slate-700 font-medium">Action Required:</strong> Review <code className="text-[10px] bg-amber-50 text-amber-700 px-1 py-0.5 rounded border border-amber-100">system_error</code> skills. You can override & resolve, or approve a retake.
                </p>
                
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-300 text-slate-700 hover:bg-slate-50 h-8 text-xs px-3 shadow-none"
                    onClick={() => handleOpenModal("resolve")}
                  >
                    Override & Resolve
                  </Button>
                  <Button
                    size="sm"
                    className="bg-amber-500 hover:bg-amber-600 text-white h-8 text-xs px-3 shadow-none"
                    onClick={() => handleOpenModal("retake")}
                  >
                    Approve Retake
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Resolve Modal */}
      <Dialog open={activeModal === "resolve"} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Mark as Resolved</DialogTitle>
            <DialogDescription>
              Confirm that you have reviewed the objection and made any necessary manual overrides.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              placeholder="Resolution Notes (e.g. 'Overrides applied based on partial answers')"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="col-span-4"
              rows={3}
              disabled={resolveState === "submitting" || resolveState === "success"}
            />
            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
            {resolveState === "success" && (
              <p className="text-sm text-emerald-600 flex items-center gap-1.5 font-medium">
                <Check className="w-4 h-4" /> Objection resolved successfully!
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseModal}
              disabled={resolveState === "submitting"}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={onConfirmResolve}
              disabled={!notes.trim() || resolveState === "submitting" || resolveState === "success"}
            >
              {resolveState === "submitting" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {resolveState === "success" ? "Resolved" : "Confirm Resolve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retake Modal */}
      <Dialog open={activeModal === "retake"} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Approve Retake</DialogTitle>
            <DialogDescription>
              This will mark the current session as void and generate a new interview link for the candidate.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {errorMsg && <p className="text-sm text-destructive mb-4">{errorMsg}</p>}
            
            {retakeState === "success" && newInviteUrl ? (
              <div className="space-y-3">
                <p className="text-sm text-emerald-600 font-medium">
                  New session generated successfully!
                </p>
                <div className="p-3 bg-slate-50 border rounded-md flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-600 truncate flex-1">
                    {newInviteUrl}
                  </span>
                  <Button size="icon" variant="ghost" onClick={handleCopyLink} className="h-8 w-8 shrink-0">
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Please copy this link and send it to the candidate.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-700">
                Are you sure you want to approve a retake? The AI data for this current session will be kept for auditing but the status will be changed to "retake_approved".
              </p>
            )}
          </div>
          <DialogFooter>
            {retakeState === "success" ? (
              <Button onClick={handleCloseModal}>Close</Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleCloseModal}
                  disabled={retakeState === "submitting"}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={onConfirmRetake}
                  disabled={retakeState === "submitting"}
                >
                  {retakeState === "submitting" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Retake
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
