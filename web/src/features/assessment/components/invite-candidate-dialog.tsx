import { valibotResolver } from "@hookform/resolvers/valibot";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { assessmentMutations } from "../mutations/assessment";
import { assessmentQueries } from "../queries/assessment";
import { createSessionSchema, type CreateSession } from "../schemas/assessment";

interface InviteCandidateDialogProps {
  assessmentId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteCandidateDialog({ assessmentId, open, onOpenChange }: InviteCandidateDialogProps) {
  const queryClient = useQueryClient();
  const [created, setCreated] = useState<{ candidateName: string; inviteUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<CreateSession>({
    mode: "onChange",
    resolver: valibotResolver(createSessionSchema),
    defaultValues: {
      candidate_name: "",
    },
  });

  const { mutate: createSession, isPending: isCreating } = useMutation({
    ...assessmentMutations.createSession(assessmentId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: assessmentQueries.sessionsKey(assessmentId) });
      setCreated({
        candidateName: res.session.candidate_name ?? "",
        inviteUrl: res.invite_url,
      });
    },
    onError: () => {
      toastManager.add({
        type: "error",
        title: "Failed to create invite link. Please try again.",
      });
    },
  });

  // Reset form setiap dialog dibuka
  useEffect(() => {
    if (!open) return;
    form.reset({ candidate_name: "" });
    setCreated(null);
    setCopied(false);
  }, [open, form]);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    []
  );

  const onSubmit = form.handleSubmit((values) => {
    createSession({
      candidate_name: values.candidate_name?.trim() || undefined,
    });
  });

  const handleCopy = () => {
    if (!created || !created.inviteUrl) return;
    navigator.clipboard.writeText(created.inviteUrl);
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{created ? "Invite link created" : "Invite Candidate"}</DialogTitle>
          {!created && (
            <DialogDescription>Generate a private interview link to share with your candidate.</DialogDescription>
          )}
        </DialogHeader>

        {created ? (
          <Empty className="p-0">
            <EmptyHeader className="max-w-full">
              <EmptyMedia variant="icon" className="size-10 bg-success/10 text-success">
                <Check className="size-5" />
              </EmptyMedia>
              <EmptyTitle>
                {created.candidateName ? (
                  <>
                    Link for <span className="font-semibold">{created.candidateName}</span> is ready
                  </>
                ) : (
                  "New invite link is ready"
                )}
              </EmptyTitle>
              <EmptyDescription>Share this link with your candidate to start the interview.</EmptyDescription>
            </EmptyHeader>

            <EmptyContent className="max-w-full">
              <InputGroup>
                <InputGroupInput value={created.inviteUrl} readOnly />
                <InputGroupAddon align="inline-end">
                  <Tooltip>
                    <TooltipTrigger
                      closeOnClick={false}
                      render={
                        <InputGroupButton
                          aria-label={copied ? "Copied!" : "Copy link"}
                          size="icon-xs"
                          onClick={handleCopy}
                        />
                      }
                    >
                      {copied ? <Check className="text-success" /> : <Copy />}
                    </TooltipTrigger>
                    <TooltipContent>{copied ? "Copied!" : "Copy link"}</TooltipContent>
                  </Tooltip>
                </InputGroupAddon>
              </InputGroup>
            </EmptyContent>
          </Empty>
        ) : (
          <form onSubmit={onSubmit}>
            <Field>
              <FieldLabel htmlFor="candidate-name">Candidate name</FieldLabel>
              <Input
                id="candidate-name"
                type="text"
                placeholder="e.g. Budi Santoso"
                autoFocus
                {...form.register("candidate_name")}
              />
              <FieldDescription>Optional — helps you identify this session later.</FieldDescription>
            </Field>

            <DialogFooter>
              <Button variant="outline" type="button" disabled={isCreating} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? <Spinner data-icon="inline-start" /> : <Link data-icon="inline-start" />}
                {isCreating ? "Creating..." : "Create Link"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
