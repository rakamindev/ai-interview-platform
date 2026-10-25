import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import { vacanciesApi } from "@/services/vacancies";
import { LEVEL_LABELS, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import { Pencil, Briefcase, Info, Target, Layers, FileText } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import type { Vacancy, VacancySkill } from "@/types";

const formatDate = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

function anchorFor(skill: VacancySkill, level: number): string | null {
  return skill[`l${level}_anchor` as keyof VacancySkill] as string | null;
}

function SidebarTextCard({
  icon,
  title,
  value,
  emptyLabel,
}: {
  icon: React.ReactNode;
  title: string;
  value?: string | null;
  emptyLabel: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-3">
        {icon}
        {title}
      </div>
      {value ? (
        <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
          {value}
        </p>
      ) : (
        <p className="text-xs text-gray-400 italic">{emptyLabel}</p>
      )}
    </div>
  );
}

export default function VacancyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    vacanciesApi
      .get(Number(id))
      .then((res) => setVacancy(res.data.vacancy))
      .catch(() => setLoadError("Failed to load vacancy data."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-5">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          <Skeleton className="h-64 w-full" />
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <Breadcrumb items={[{ label: "Vacancies", href: "/vacancies" }]} />
        <div className="border rounded-xl p-8 text-center space-y-3">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/vacancies")}
          >
            Back to Vacancies
          </Button>
        </div>
      </div>
    );
  }

  const skills = vacancy?.skills ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Vacancies", href: "/vacancies" },
          { label: vacancy?.role_title ?? "—" },
        ]}
      />

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">{vacancy?.role_title ?? "—"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {skills.length} skill{skills.length !== 1 ? "s" : ""} required
            {vacancy?.created_at && ` · Created ${formatDate(vacancy.created_at)}`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/vacancies/${id}/edit`)}
        >
          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
        {/* Main: Skills & criteria */}
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center gap-1.5 px-5 py-3.5 border-b border-gray-200 text-sm font-semibold text-gray-900">
            <Target className="w-4 h-4 text-teal-600" />
            Expected skills &amp; criteria
          </div>

          {skills.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="h-6 w-6 text-muted-foreground" />}
              title="No skills defined"
              description="Add the skills this role requires so candidates can be evaluated against it."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/vacancies/${id}/edit`)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Add skills
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-gray-100">
              {skills.map((s) => {
                const anchor = anchorFor(s, s.expected_level);
                return (
                  <div key={s.id ?? s.skill_label} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {s.skill_label}
                      </span>
                      <span className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                          {LEVEL_LABELS[s.expected_level]}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {LEVEL_DESCRIPTIONS[s.expected_level]}
                        </span>
                      </span>
                    </div>

                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-teal-500 rounded-full"
                        style={{ width: `${(s.expected_level / 5) * 100}%` }}
                      />
                    </div>

                    {anchor ? (
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {anchor}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 italic">
                        No rubric description for this skill.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {/* Vacancy info */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-3">
              <Info className="w-4 h-4 text-teal-600" />
              Vacancy details
            </div>
            <div className="space-y-0">
              {[
                { k: "Skills required", v: `${skills.length}` },
                { k: "Created", v: formatDate(vacancy?.created_at) },
                { k: "Updated", v: formatDate(vacancy?.updated_at) },
              ].map((row) => (
                <div
                  key={row.k}
                  className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0 text-xs"
                >
                  <span className="text-gray-500">{row.k}</span>
                  <span className="font-medium text-gray-900">{row.v}</span>
                </div>
              ))}
            </div>
          </div>

          <SidebarTextCard
            icon={<Layers className="w-4 h-4 text-teal-600" />}
            title="Culture dimensions"
            value={vacancy?.culture_dimensions}
            emptyLabel="Not defined yet."
          />

          <SidebarTextCard
            icon={<FileText className="w-4 h-4 text-teal-600" />}
            title="Competency expectations"
            value={vacancy?.competency_expectations}
            emptyLabel="Not defined yet."
          />
        </div>
      </div>
    </div>
  );
}