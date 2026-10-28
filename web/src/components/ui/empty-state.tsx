import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  // 1 when the empty state is the whole page (e.g. not found).
  headingLevel?: 1 | 2;
  className?: string;
}

// Nothing to show yet, with the next step to take.
export function EmptyState({ icon: Icon, title, description, action, headingLevel = 2, className }: EmptyStateProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <section className={cn("flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center", className)}>
      {Icon && <Icon aria-hidden="true" className="h-8 w-8 text-muted-foreground" />}
      <Heading className={cn("font-semibold", headingLevel === 1 ? "text-xl" : "text-base")}>{title}</Heading>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action}
    </section>
  );
}
