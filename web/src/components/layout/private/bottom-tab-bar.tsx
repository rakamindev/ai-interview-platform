import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getSidebarNavItems } from "./utils";

export default function BottomTabBar() {
  const location = useLocation();
  const navGroups = getSidebarNavItems();
  const items = navGroups.flatMap((g) => g.items);

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 flex h-16 w-full items-center justify-around border-t border-border/60 bg-background/95 backdrop-blur-md sm:hidden pb-[env(safe-area-inset-bottom)]"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href &&
          (location.pathname === item.href ||
            (item.href !== "/assessments" &&
              location.pathname.startsWith(`${item.href}/`)));

        return (
          <Link
            key={item.name}
            to={item.href || "#"}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-1.5 px-3 text-xs transition-colors h-full select-none",
              isActive
                ? "font-semibold text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5 transition-transform",
                isActive && "stroke-[2.5px] scale-105"
              )}
            />
            <span className="text-[11px] leading-tight">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
