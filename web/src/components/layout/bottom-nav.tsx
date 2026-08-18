import { Link } from "@tanstack/react-router";
import { Briefcase, ClipboardList } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { to: "/assessments", label: "Assessments", icon: ClipboardList },
  { to: "/vacancies", label: "Vacancies", icon: Briefcase },
] as const;

export function BottomNav() {
  return (
    <nav
      aria-label="bottom navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden"
    >
      <div className="grid grid-cols-2">
        {NAV_LINKS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
              "aria-[current=page]:text-primary [&_svg]:size-5 [&_svg]:shrink-0"
            )}
          >
            <item.icon />
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
