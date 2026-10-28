import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageShellProps {
  // "narrow" for forms, so fields do not stretch across a wide screen.
  width?: "default" | "narrow";
  className?: string;
  children: React.ReactNode;
}

// The content column of an assessor page. The layout already provides <main>.
export function PageShell({ width = "default", className, children }: PageShellProps) {
  return (
    <div className={cn("mx-auto w-full space-y-6", width === "narrow" ? "max-w-3xl" : "max-w-5xl", className)}>
      {children}
    </div>
  );
}
