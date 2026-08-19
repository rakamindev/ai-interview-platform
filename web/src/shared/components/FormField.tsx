import { Input, type InputProps } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormFieldProps extends InputProps {
  label: string;
  error?: string;
}

/**
 * Label + Input + error message, composed once. Any form that needs a plain
 * text/email/number field should reach for this instead of hand-wiring
 * Label + Input + error markup again.
 */
export default function FormField({ id, label, error, ...props }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={!!error} {...props} />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
