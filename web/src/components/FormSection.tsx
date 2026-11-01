import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

// A titled card that groups related form fields.
export default function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-5 space-y-1">
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </Card>
  );
}
