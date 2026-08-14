import { Link, useLocation } from "react-router-dom";
import { ClipboardList, Briefcase, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/vacancies", label: "Vacancies", icon: Briefcase },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "md:hidden", // only on mobile
        "flex items-stretch",
        "bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg",
        "pb-safe", // iOS safe area
      )}
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const isActive = location.pathname.startsWith(href);
        return (
          <Link
            key={href}
            to={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 touch-feedback relative",
              "text-xs font-semibold transition-colors duration-150",
              isActive
                ? "text-primary"
                : "text-slate-500 hover:text-slate-900"
            )}
            aria-label={label}
          >
            <Icon
              className={cn(
                "h-5 w-5 transition-all duration-150",
                isActive ? "text-primary stroke-[2.5] scale-110" : "text-slate-400"
              )}
            />
            <span>{label}</span>
            {isActive && (
              <span className="absolute bottom-[calc(env(safe-area-inset-bottom,4px)+2px)] w-8 h-1 rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
