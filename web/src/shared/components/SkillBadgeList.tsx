import { Badge } from "@/shared/ui/badge";

interface SkillBadgeListProps {
  labels: string[];
  max?: number;
}

export default function SkillBadgeList({ labels, max = 3 }: SkillBadgeListProps) {
  if (labels.length === 0) return null;

  const visible = labels.slice(0, max);
  const overflow = labels.length - visible.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((label) => (
        <Badge key={label} variant="secondary" className="font-normal">
          {label}
        </Badge>
      ))}
      {overflow > 0 && (
        <Badge variant="outline" className="font-normal text-muted-foreground">
          +{overflow}
        </Badge>
      )}
    </div>
  );
}
