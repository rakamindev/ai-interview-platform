import { forwardRef } from "react";
import { Input, type InputProps } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

interface FormFieldProps extends InputProps {
  label: string;
  error?: string;
}

const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ id, label, error, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Input id={id} aria-invalid={!!error} ref={ref} {...props} />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }
);
FormField.displayName = "FormField";

export default FormField;
