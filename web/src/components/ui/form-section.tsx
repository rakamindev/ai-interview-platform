import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FormSectionProps {
  title: string;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

// A card for one group of fields, named by its h2 so it is a region landmark.
export function FormSection({ title, description, className, children }: FormSectionProps) {
  const headingId = React.useId();
  return (
    <section aria-labelledby={headingId} className={cn("space-y-4 rounded-lg border bg-card p-4 shadow-sm sm:p-6", className)}>
      <div className="space-y-1">
        <h2 id={headingId} className="text-base font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export interface FieldErrorProps {
  // Referenced by the field's aria-describedby.
  id: string;
  children?: React.ReactNode;
}

// An inline field error with an icon; renders nothing without a message.
export function FieldError({ id, children }: FieldErrorProps) {
  if (!children) return null;
  return (
    <p id={id} className="flex items-center gap-1 text-sm text-destructive">
      <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
