import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { vacanciesApi } from "@/services/vacancies";
import { Plus, Briefcase, Eye, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Vacancy } from "@/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    vacanciesApi
      .list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive mb-4">
          Failed to load vacancies. Please refresh the page.
        </div>
      )}

      <div className="bg-canvas rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-heading-md font-semibold text-ink">Vacancies</h1>
          <Button onClick={() => navigate("/vacancies/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
          </Button>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[3fr_0.5fr] gap-4 p-2 mb-2 bg-canvas-soft rounded-md text-ink-mute-2 text-sm font-semibold uppercase tracking-wider">
          <div>VACANCY</div>
          <div>ACTION</div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : vacancies.length === 0 ? (
          <div className="border border-hairline-strong rounded-lg p-12 text-center text-body-md text-ink-mute">
            <p className="mb-3">No vacancies yet.</p>
            <Button
              variant="outline"
              onClick={() => navigate("/vacancies/new")}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Create your first vacancy
            </Button>
          </div>
        ) : (
          <div className="space-y-2 bg-canvas">
            {vacancies.map((v, index) => (
              <div
                key={v.id}
                className={cn(
                  "py-3 px-4 grid grid-cols-[3fr_0.5fr] items-center gap-4",
                  "hover:bg-canvas-soft transition-colors",
                  index < vacancies.length - 1
                    ? "border-b border-hairline"
                    : "",
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-ink-mute" />
                    <p className="font-medium text-body-md text-ink">
                      {v.role_title}
                    </p>
                  </div>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/vacancies/${v.id}/edit`);
                        }}
                      >
                        <Pencil className="h-4 w-4 text-ink-mute" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Edit</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
