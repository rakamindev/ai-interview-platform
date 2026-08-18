import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Calendar } from "lucide-react";

import { Frame, FramePanel } from "@/components/ui/frame";
import { Skeleton } from "@/components/ui/skeleton";

import type { Vacancy } from "../schemas/vacancy";

interface VacancyCardProps {
  data: Vacancy;
}

export function VacancyCard({ data }: VacancyCardProps) {
  return (
    <Frame
      className="group h-full"
      spacing="sm"
      dense
      render={<Link to="/vacancies/$vacancyId" params={{ vacancyId: String(data.id) }} />}
    >
      <FramePanel>
        <div className="flex h-full flex-col justify-between gap-3">
          <h3
            title={data.role_title}
            className="line-clamp-2 font-heading text-base font-medium group-hover:text-primary group-hover:underline group-hover:underline-offset-3"
          >
            {data.role_title}
          </h3>

          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="size-4 shrink-0" />
              Created
            </p>
            <p className="text-right text-sm font-medium text-foreground tabular-nums">
              {format(data.created_at, "dd/MM/yyyy HH:mm")}
            </p>
          </div>
        </div>
      </FramePanel>
    </Frame>
  );
}

export function VacancyCardSkeleton() {
  return (
    <Frame spacing="sm" dense>
      <FramePanel className="space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </FramePanel>
    </Frame>
  );
}
