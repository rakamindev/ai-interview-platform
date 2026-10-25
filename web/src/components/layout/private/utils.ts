import { Briefcase, ClipboardList } from "lucide-react";
import React from "react";

export interface NavItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const getSidebarNavItems = (): NavGroup[] => {
  return [
    {
      label: "Platform",
      items: [
        {
          name: "Assessments",
          href: "/assessments",
          icon: ClipboardList,
        },
        {
          name: "Vacancies",
          href: "/vacancies",
          icon: Briefcase,
        },
      ],
    },
  ];
};

export const getInitialProfile = (name?: string | null): string => {
  if (!name) return "A";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
};
