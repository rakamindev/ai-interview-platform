import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import SkillBadgeList from "@/shared/components/SkillBadgeList";

interface EntityListCardProps {
  onClick: () => void;
  icon?: LucideIcon;
  title: string;
  meta?: ReactNode;
  badges?: string[];
  timestamp?: string;
  trailing?: ReactNode;
}

export default function EntityListCard({
  onClick,
  icon: Icon,
  title,
  meta,
  badges,
  timestamp,
  trailing,
}: EntityListCardProps) {
  return (
    <Card
      className="cursor-pointer hover:border-primary/40 transition-colors"
      onClick={onClick}
    >
      <CardContent className="py-5 px-6 flex items-center justify-between gap-6">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2.5">
            {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
            <p className="font-medium text-[15px]">{title}</p>
          </div>
          {meta && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              {meta}
            </div>
          )}
          {badges && <SkillBadgeList labels={badges} />}
          {timestamp && <p className="text-[11px] text-muted-foreground">{timestamp}</p>}
        </div>
        {trailing ?? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </CardContent>
    </Card>
  );
}
