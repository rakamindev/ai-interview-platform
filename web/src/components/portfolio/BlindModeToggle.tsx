import { Button } from "@/components/ui/button";
import { EyeOff, Eye } from "lucide-react";

interface BlindModeToggleProps {
  blind: boolean;
  onToggle: (blind: boolean) => void;
}

// UU PDP + bias-reduction control: anonymize candidate PII while evaluating.
export default function BlindModeToggle({ blind, onToggle }: BlindModeToggleProps) {
  return (
    <Button
      variant={blind ? "secondary" : "outline"}
      size="sm"
      onClick={() => onToggle(!blind)}
      title={
        blind
          ? "Turn off blind mode to reveal candidate identity"
          : "Hide candidate identity during evaluation to reduce bias (UU PDP)"
      }
    >
      {blind ? <Eye className="h-3.5 w-3.5 mr-1.5" /> : <EyeOff className="h-3.5 w-3.5 mr-1.5" />}
      {blind ? "Blind mode ON" : "Blind mode"}
    </Button>
  );
}