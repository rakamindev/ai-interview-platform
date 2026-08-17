import { useState } from "react";
import { sessionsApi } from "@/services/sessions";
import type { Session } from "@/types";

export type ResolveState = "idle" | "submitting" | "success" | "error";

export function useResolveObjection() {
  const [resolveState, setResolveState] = useState<ResolveState>("idle");
  const [retakeState, setRetakeState] = useState<ResolveState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null);

  const resolveObjection = async (
    sessionId: number,
    notes: string,
    onSuccess?: (session: Session) => void
  ) => {
    setResolveState("submitting");
    setErrorMsg(null);
    try {
      const res = await sessionsApi.resolve(sessionId, notes);
      setResolveState("success");
      onSuccess?.(res.data.session);
    } catch (err: any) {
      setResolveState("error");
      setErrorMsg(err.response?.data?.error || "Failed to resolve objection");
    }
  };

  const approveRetake = async (
    sessionId: number,
    onSuccess?: (session: Session) => void
  ) => {
    setRetakeState("submitting");
    setErrorMsg(null);
    try {
      const res = await sessionsApi.retake(sessionId);
      setNewInviteUrl(res.data.invite_url);
      setRetakeState("success");
      onSuccess?.(res.data.session);
    } catch (err: any) {
      setRetakeState("error");
      setErrorMsg(err.response?.data?.error || "Failed to approve retake");
    }
  };

  const resetState = () => {
    setResolveState("idle");
    setRetakeState("idle");
    setErrorMsg(null);
    setNewInviteUrl(null);
  };

  return {
    resolveState,
    retakeState,
    errorMsg,
    newInviteUrl,
    resolveObjection,
    approveRetake,
    resetState,
  };
}
