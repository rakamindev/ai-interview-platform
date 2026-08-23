import { UseFormReturn } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import CustomSkillForm from "./CustomSkillForm";
import type { AssessmentFormValues } from "@/features/assessments/pages/AssessmentNewPage";

interface CustomSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  index: number;
  form: UseFormReturn<AssessmentFormValues>;
  onDiscardIfBlank: () => void;
}

export default function CustomSkillDialog({
  open,
  onOpenChange,
  index,
  form,
  onDiscardIfBlank,
}: CustomSkillDialogProps) {
  const handleOpenChange = (next: boolean) => {
    if (!next && !form.getValues(`skills.${index}.skill_label`)) {
      onDiscardIfBlank();
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Custom Skill</DialogTitle>
        </DialogHeader>

        <CustomSkillForm index={index} form={form} />

        <DialogFooter>
          <Button type="button" onClick={() => handleOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
