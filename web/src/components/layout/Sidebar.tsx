import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ClipboardList,
  Briefcase,
  LogOut,
  Home,
  Calendar,
  Settings,
  Info,
  Send,
  Bell,
} from "lucide-react";

interface SidebarProps {
  className?: string;
  onLogout: () => void; // Add onLogout prop
  logoIcon: React.ElementType; // Icon component for the logo
  logoHref: string; // Href for the logo link
}

const sidebarNavItems = [
  // { href: "/dashboard", label: "Home", icon: Home },
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/vacancies", label: "Vacancies", icon: Briefcase },
  // { href: "/schedule", label: "Schedule", icon: Calendar },
  // { href: "/settings", label: "Settings", icon: Settings },
  // { href: "/info", label: "Info", icon: Info },
];

export default function Sidebar({
  className,
  onLogout, // Destructure onLogout prop
  logoIcon: LogoIcon, // Destructure with rename to avoid conflict
  logoHref,
}: SidebarProps) {
  const location = useLocation();

  return (
    <div
      className={cn(
        "flex flex-col h-[calc(100vh-24px)] p-4 bg-canvas-night text-on-dark shadow-lg z-50",
        "w-[100px] fixed top-3 left-3 rounded-lg",
        className,
      )}
    >
      {/* Top Section: Logo */}
      <div className="mb-8 p-2 flex items-center justify-center">
        <Link
          to={logoHref}
          className="flex items-center justify-center p-3 rounded-md text-primary"
        >
          <LogoIcon className="h-8 w-8" />
        </Link>
      </div>

      {/* Main Navigation Items */}
      <nav className="flex-1 space-y-2">
        {sidebarNavItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex items-center justify-center p-3 rounded-md transition-colors",
              location.pathname.startsWith(item.href)
                ? "bg-ink-secondary text-primary" // Active state
                : "text-ink-faint hover:bg-ink-secondary hover:text-on-dark", // Inactive state
            )}
          >
            <item.icon className="h-6 w-6" />
          </Link>
        ))}
      </nav>

      {/* Bottom Section: Logout */}
      <div className="mt-auto p-2">
        <button
          onClick={onLogout}
          className="flex items-center justify-center p-3 rounded-md text-ink-faint hover:bg-ink-secondary hover:text-on-dark transition-colors w-full"
        >
          <LogOut className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
