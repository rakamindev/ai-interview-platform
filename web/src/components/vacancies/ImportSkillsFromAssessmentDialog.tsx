import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { assessmentsApi } from "@/services/assessments";
import type { Assessment, AssessmentSkill } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (skills: AssessmentSkill[]) => void;
}

export default function ImportSkillsFromAssessmentDialog({ open, onOpenChange, onImport }: Props) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingList(true);
    setSelectedId("");
    assessmentsApi.list()
      .then((res) => setAssessments(res.data.assessments))
      .finally(() => setLoadingList(false));
  }, [open]);

  const handleImport = async () => {
    if (!selectedId) return;
    setImporting(true);
    try {
      const res = await assessmentsApi.get(Number(selectedId));
      onImport(res.data.assessment.skills ?? []);
      onOpenChange(false);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Import Skills from Assessment</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <p className="text-xs text-muted-foreground">
            Copies skill names and expected levels from an existing assessment
            into this vacancy. You can still edit levels or remove skills
            after importing.
          </p>

          {loadingList ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading assessments...
            </div>
          ) : assessments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No assessments found yet.
            </p>
          ) : (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an assessment" />
              </SelectTrigger>
              <SelectContent>
                {assessments.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleImport} disabled={!selectedId || importing}>
            {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Import Skills
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
