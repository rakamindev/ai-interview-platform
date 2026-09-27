import { Info } from "lucide-react";

export default function SkillNameTip() {
    return (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Each skill needs its own name. Names that differ only in capital letters or spaces count as the same skill.
        </p>
    );
}
