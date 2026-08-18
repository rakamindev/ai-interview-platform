import React from "react";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteSchema } from "../../pages/assessments/inviteSchema";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<z.infer<typeof inviteSchema>>;
  onSubmit: (data: z.infer<typeof inviteSchema>) => void;
  loading?: boolean;
}

const DialogInvite = ({ open, onOpenChange, form, onSubmit, loading }: Props) => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Invite Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {errors.root?.serverError && (
              <div className="bg-destructive/15 p-3 rounded-md text-sm text-destructive mb-3">
                <p>{errors.root.serverError.message}</p>
              </div>
            )}
            <Label htmlFor="candidate-name">Candidate name</Label>
            <Input
              id="candidate-name"
              placeholder="e.g. Budi Santoso"
              error={!!errors.candidate_name}
              {...register("candidate_name")}
              autoFocus
            />
            {errors.candidate_name && <p className="text-sm font-medium text-destructive">{errors.candidate_name.message}</p>}
            <p className="text-xs text-muted-foreground">Optional — helps you identify this session later.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="mt-2 sm:mt-0" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={loading || isSubmitting}>Create Link</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(DialogInvite);