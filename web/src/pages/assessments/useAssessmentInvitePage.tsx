import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { assessmentsApi } from "@/services/assessments";
import type { Assessment, Session } from "@/types";
import { inviteSchema } from "./inviteSchema";

interface Props {
  id?: string;
}

export const useAssessmentInvitePage = ({ id }: Props) => {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);
  const [newSession, setNewSession] = useState<Session | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [newSessionCopied, setNewSessionCopied] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
  });

  const loadSessions = useCallback(async () => {
    const res = await assessmentsApi.getSessions(Number(id));
    setSessions(res.data.sessions);
  }, [id]);

  const refetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    Promise.all([
      assessmentsApi.get(Number(id)),
      assessmentsApi.getSessions(Number(id)),
    ]).then(([aRes, sRes]) => {
      setAssessment(aRes.data.assessment);
      setSessions(sRes.data.sessions);
    }).catch(() => setFetchError(true)).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    refetchData();
  }, [id]);

  // Poll while any session is live or pending
  useEffect(() => {
    const hasActive = sessions.some((s) => s.status !== "ended");
    if (!hasActive) return;
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, [sessions, loadSessions]);

  const openInviteDialog = () => {
    form.reset({ candidate_name: "" });
    setShowInviteDialog(true);
  };

  const onInviteSubmit = async (data: z.infer<typeof inviteSchema>) => {
    setCreatingSession(true);
    form.clearErrors();
    setNewSession(null);
    try {
      const res = await assessmentsApi.createSession(Number(id), data.candidate_name?.trim() || undefined);
      const created = res.data.session;
      setNewSession(created);
      setSessions((prev) => [created, ...prev]);
      setShowInviteDialog(false);
    } catch (e) {
      let message = "Failed to create invite link. Please try again.";
      if (axios.isAxiosError(e) && e.response?.data?.errors?.[0]?.message) {
        message = e.response.data.errors[0].message;
      }
      form.setError("root.serverError", {
        type: "manual",
        message,
      });
    } finally {
      setCreatingSession(false);
    }
  };

  const copyLink = (session: Session, id: number) => {
    navigator.clipboard.writeText(session.invite_url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyNewSessionLink = () => {
    if (!newSession?.invite_url) return;
    navigator.clipboard.writeText(newSession.invite_url);
    setNewSessionCopied(true);
    setTimeout(() => setNewSessionCopied(false), 2000);
  };

  return {
    fetchError,
    assessment,
    sessions,
    loading,
    creatingSession,
    newSession,
    copiedId,
    newSessionCopied,
    showInviteDialog,
    form,
    refetchData,
    openInviteDialog,
    onInviteSubmit,
    copyLink,
    copyNewSessionLink,
    setShowInviteDialog,
  }
}