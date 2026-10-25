import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminInvitationsApi,
  type AdminInvitation,
  type AdminInvitationStatus,
} from "@/services/adminInvitations";
import { extractApiError } from "@/lib/apiErrors";
import { toast } from "@/stores/toastStore";
import { adminInvitationKeys } from "@/lib/queryKeys";
import { Check, Copy, Loader2, MailPlus, RefreshCw, UserPlus, XCircle } from "lucide-react";

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

interface InvitationFormValues {
  email: string;
}

const statusVariant: Record<AdminInvitationStatus, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  accepted: "secondary",
  revoked: "destructive",
  expired: "outline",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminInvitationsPage() {
  const queryClient = useQueryClient();
  const [createError, setCreateError] = useState<string | null>(null);
  const [signupLink, setSignupLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InvitationFormValues>({
    defaultValues: { email: "" },
    mode: "onTouched",
  });

  const invitationsQuery = useQuery({
    queryKey: adminInvitationKeys.list(),
    queryFn: async () => (await adminInvitationsApi.list()).data.invitations,
  });
  const invitations = invitationsQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: (email: string) => adminInvitationsApi.create(email),
    onSuccess: (response) => {
      queryClient.setQueryData<AdminInvitation[]>(adminInvitationKeys.list(), (current = []) => [
        response.data.invitation,
        ...current,
      ]);
      setSignupLink(response.data.signup_url);
      reset();
      toast.success("Invitation created", "Copy the link and send it to the recipient.");
    },
    onError: (error) => setCreateError(extractApiError(error).message),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => adminInvitationsApi.revoke(id),
    onSuccess: (response, id) => {
      queryClient.setQueryData<AdminInvitation[]>(adminInvitationKeys.list(), (current = []) =>
        current.map((invitation) =>
          invitation.id === id ? response.data.invitation : invitation
        )
      );
      toast.success("Invitation revoked");
    },
    onError: (error) => {
      toast.error("Unable to revoke invitation", extractApiError(error).message);
    },
  });

  const createInvitation = async ({ email }: InvitationFormValues) => {
    setCreateError(null);
    setSignupLink(null);
    setCopied(false);
    createMutation.mutate(email);
  };

  const copyLink = async () => {
    if (!signupLink) return;

    try {
      await navigator.clipboard.writeText(signupLink);
      setCopied(true);
      toast.success("Invitation link copied");
    } catch {
      toast.error("Unable to copy the invitation link", "Select and copy the link manually.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Administrator Invitations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite administrators to this organization. Each link is bound to one email and can be used once.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSubmit(createInvitation)} className="space-y-3" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="invitation-email">Recipient email</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="invitation-email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@company.com"
                  aria-invalid={errors.email ? true : undefined}
                  {...register("email", {
                    required: "Email is required.",
                    pattern: { value: EMAIL_PATTERN, message: "Enter a valid email address." },
                  })}
                />
                <Button type="submit" className="shrink-0" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />}
                  Create invitation
                </Button>
              </div>
              {errors.email && <p className="text-xs text-destructive" role="alert">{errors.email.message}</p>}
            </div>

            {createError && <Alert><p>{createError}</p></Alert>}

            {signupLink && (
              <Alert variant="info">
                <div className="space-y-2">
                  <div>
                    <p className="font-medium">Copy this link now</p>
                    <p className="text-xs">For security, it will not be available again after leaving this page.</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input value={signupLink} readOnly aria-label="New administrator invitation link" />
                    <Button type="button" variant="outline" onClick={copyLink}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>
              </Alert>
            )}
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3" aria-labelledby="invitation-list-title">
        <div className="flex items-center justify-between gap-2">
          <h2 id="invitation-list-title" className="font-semibold">Invitation history</h2>
          <Button type="button" variant="ghost" size="sm" onClick={() => void invitationsQuery.refetch()} disabled={invitationsQuery.isFetching}>
            <RefreshCw className={invitationsQuery.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Refresh
          </Button>
        </div>

        {invitationsQuery.isError && (
          <Alert>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>Failed to load invitations.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void invitationsQuery.refetch()}>Try again</Button>
            </div>
          </Alert>
        )}

        {invitationsQuery.isPending ? (
          <div className="space-y-2">
            {[1, 2, 3].map((item) => <Skeleton key={item} className="h-24 w-full" />)}
          </div>
        ) : !invitationsQuery.isError && invitations.length === 0 ? (
          <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
            <UserPlus className="mx-auto mb-3 h-8 w-8" />
            No administrator invitations yet.
          </div>
        ) : (
          <div className="space-y-2">
            {invitations.map((invitation) => (
              <Card key={invitation.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-all text-sm font-medium">{invitation.recipient_email}</p>
                      <Badge variant={statusVariant[invitation.status]}>{invitation.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Created by {invitation.inviter_email} · Expires {formatDate(invitation.expires_at)}
                    </p>
                  </div>
                  {invitation.status === "active" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={revokeMutation.isPending && revokeMutation.variables === invitation.id}
                      onClick={() => revokeMutation.mutate(invitation.id)}
                    >
                      {revokeMutation.isPending && revokeMutation.variables === invitation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Revoke
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
