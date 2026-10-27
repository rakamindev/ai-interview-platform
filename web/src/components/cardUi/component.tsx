import { Briefcase, ChevronRight, LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import React from "react";

interface VacancyCardProps {
  id: number;
  children: React.ReactNode;
  Icon: LucideIcon;
  onClick: () => void;
}

export function CardUi({ id, onClick, children, Icon }: VacancyCardProps) {
  return (
    <Card
      key={id}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="group cursor-pointer overflow-hidden border-border/70 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <CardContent className="p-4 sm:p-5">
        {/* Icon and action */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center justify-center transition-colors h-11 w-11 shrink-0 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
            <Icon className="w-5 h-5" />
          </div>

          <div className="flex items-center justify-center w-8 h-8 transition-all rounded-full shrink-0 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>

        {/*information */}
        {children}
      </CardContent>
    </Card>
  );
}
