import * as React from "react";
import { AlertTriangle, CheckCircle2, Circle, Clock, Radio, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

// Text colours meet WCAG AA (4.5:1) on their tinted background.
const TONES: Record<StatusTone, { className: string; icon: LucideIcon }> = {
  success: { className: "border-green-200 bg-green-50 text-green-800", icon: CheckCircle2 },
  warning: { className: "border-amber-200 bg-amber-50 text-amber-900", icon: Clock },
  danger: { className: "border-red-200 bg-red-50 text-red-800", icon: AlertTriangle },
  info: { className: "border-teal-200 bg-teal-50 text-teal-800", icon: Radio },
  neutral: { className: "border-slate-200 bg-slate-100 text-slate-700", icon: Circle },
};

export interface StatusBadgeProps {
  tone: StatusTone;
  icon?: LucideIcon;
  className?: string;
  children: React.ReactNode;
}

// A status as an icon plus text, never colour alone.
export function StatusBadge({ tone, icon, className, children }: StatusBadgeProps) {
  const Icon = icon ?? TONES[tone].icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", TONES[tone].className, className)}>
      <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />
      {children}
    </span>
  );
}
