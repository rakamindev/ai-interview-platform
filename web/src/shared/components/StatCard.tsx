import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { cn } from "@/shared/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  accent?: "primary" | "secondary";
  live?: boolean;
}

const ACCENT_STYLES = {
  primary: { badge: "bg-primary/15 text-primary", glow: "bg-primary/25" },
  secondary: { badge: "bg-secondary/30 text-secondary-foreground", glow: "bg-secondary/35" },
};

export default function StatCard({ icon: Icon, label, value, accent = "primary", live }: StatCardProps) {
  const styles = ACCENT_STYLES[accent];

  return (
    <Card className="relative overflow-hidden">
      <div className={cn("absolute -right-6 -top-8 h-24 w-24 rounded-full blur-2xl", styles.glow)} />
      <CardContent className="relative py-4 px-4 flex items-center gap-3">
        <div className={cn("flex items-center justify-center h-10 w-10 rounded-full shrink-0", styles.badge)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-data text-2xl font-semibold leading-none tracking-tight">{value}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            {live && (
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
            )}
            <p className="text-xs text-muted-foreground truncate">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
