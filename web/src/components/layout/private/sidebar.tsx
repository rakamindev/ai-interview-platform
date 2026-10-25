import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSidebarNavItems } from "./utils";

interface PrivateSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function PrivateSidebar({
  collapsed,
  onToggle,
}: PrivateSidebarProps) {
  const location = useLocation();
  const navGroups = getSidebarNavItems();

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-border/60 bg-card/60 backdrop-blur-md transition-all duration-300 relative z-30 shrink-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between border-b border-border/40 px-3">
        <Link
          to="/assessments"
          className={cn(
            "flex items-center gap-2.5 overflow-hidden transition-all",
            collapsed ? "justify-center w-full" : "px-2"
          )}
        >
          <div className="flex h-8 w-8 min-w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-foreground leading-tight">
                Rakamin
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">
                AI Interview
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Content */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            {!collapsed && (
              <h4 className="px-3 text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">
                {group.label}
              </h4>
            )}
            <nav className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href &&
                  (location.pathname === item.href ||
                    location.pathname.startsWith(`${item.href}/`));

                return (
                  <Link
                    key={item.name}
                    to={item.href || "#"}
                    title={collapsed ? item.name : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all group",
                      collapsed ? "justify-center px-0" : "",
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform group-hover:scale-105",
                        isActive ? "text-primary-foreground" : "text-muted-foreground"
                      )}
                    />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Toggle collapse button */}
      <div className="p-2 border-t border-border/40 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8 mx-auto text-muted-foreground hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Footer Info */}
      {!collapsed && (
        <div className="border-t border-border/40 p-3 text-[11px] text-muted-foreground flex items-center justify-between">
          <span>v2.0</span>
          <span className="text-emerald-500 font-medium">Platform Ready</span>
        </div>
      )}
    </aside>
  );
}
