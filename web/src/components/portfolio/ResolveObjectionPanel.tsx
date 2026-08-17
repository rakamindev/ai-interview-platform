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
      <div className="bg-amber-50/80 backdrop-blur-md border border-amber-200 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-1.5">
            <span>⚠️</span> Technical Objection Filed
          </h3>
          <span className="px-2.5 py-0.5 bg-amber-200 border border-amber-300 text-amber-900 text-[10px] font-bold uppercase rounded-full tracking-wider animate-pulse">
            Needs Review
          </span>
        </div>
        <p className="text-xs text-amber-800 leading-relaxed">
          The candidate reported a technical or network issue during this session.
        </p>
        <div className="bg-white/80 border border-amber-100 p-3 rounded-lg text-xs font-mono text-slate-700 italic break-words">
          "{session.candidate_objection_notes}"
        </div>
        <p className="text-[10px] text-slate-500">
          <strong>Resolution Guide:</strong> Review the unassessed skills marked with <em>"system_error"</em>. You can override scores and resolve, or approve a complete retake.
        </p>
        <div className="pt-2 flex gap-3">
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => handleOpenModal("retake")}
          >
            Approve Retake
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-white border-amber-300 text-amber-800 hover:bg-amber-100"
            onClick={() => handleOpenModal("resolve")}
          >
            Override & Resolve
          </Button>
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
