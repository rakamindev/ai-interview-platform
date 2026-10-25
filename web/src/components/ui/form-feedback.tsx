import { cn } from "@/lib/utils";

// Field-level validation error (formState.errors). Links to the input via id
// passed through `aria-describedby` for screen readers.
export function FieldError({
  id,
  message,
  className,
}: {
  id?: string;
  message?: string;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className={cn("text-xs text-destructive mt-1", className)}>
      {message}
    </p>
  );
}

// Page-level alert (submit/network error banner). Uses inline `alert` role.
export function FormAlert({
  message,
  className,
}: {
  message: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        "border border-destructive/40 bg-destructive/5 rounded-lg px-4 py-3 text-sm text-destructive",
        className
      )}
    >
      {message}
    </div>
  );
}
