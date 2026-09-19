import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BannerTone = "ok" | "warn" | "info" | "fail";

const toneClasses: Record<BannerTone, string> = {
  ok: "border-[#b8e2c8] bg-ok-soft text-[#11613c]",
  warn: "border-[#ecd3a4] bg-warn-soft text-[#7c4a02]",
  info: "border-[#c2e4e6] bg-brand-soft text-brand-deep",
  fail: "border-[#f2c2c2] bg-danger-soft text-[#8f2f2f]",
};

interface BannerProps {
  tone?: BannerTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function Banner({ tone = "info", icon, children, className }: BannerProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm",
        toneClasses[tone],
        className
      )}
    >
      {icon && <span className="shrink-0 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
