import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { assessmentsApi } from "@/services/assessments";
import { FileText, Loader2, RefreshCw } from "lucide-react";

interface SystemPromptPreviewProps {
  assessmentId: number;
  variant?: "outline" | "ghost" | "default";
  className?: string;
}

export default function SystemPromptPreview({
  assessmentId,
  variant = "outline",
  className,
}: SystemPromptPreviewProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);

  const loadPrompt = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await assessmentsApi.getSystemPrompt(assessmentId);
      setPrompt(res.data.system_prompt);
    } catch {
      setError("Failed to load the system prompt.");
      setPrompt(null);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && prompt === null && error === null) void loadPrompt();
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size="sm"
        className={className}
        onClick={() => handleOpenChange(true)}
      >
        <FileText className="h-3.5 w-3.5 mr-1.5" /> Preview system prompt
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>System prompt (read-only)</DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Compiling prompt…
            </div>
          ) : error ? (
            <div className="space-y-3 py-4">
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
              <Button variant="outline" size="sm" onClick={() => void loadPrompt()}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          ) : prompt ? (
            <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted/40 p-4 text-xs leading-relaxed whitespace-pre-wrap">
              {prompt}
            </pre>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
