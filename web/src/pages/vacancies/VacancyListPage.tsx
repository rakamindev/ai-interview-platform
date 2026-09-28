import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import ResourceList from "@/components/ui/resource-list";
import { vacanciesApi } from "@/services/vacancies";
import type { Vacancy } from "@/types";
const load = async (page: number) => {
  const { data } = await vacanciesApi.list(page);
  return { records: data.vacancies, meta: data.meta };
};
export default function VacancyListPage() {
  return (
    <ResourceList<Vacancy>
      title="Vacancies"
      singular="vacancy"
      description="Define role requirements for consistent candidate evaluation."
      createHref="/vacancies/new"
      load={load}
      name={(v) => v.role_title}
      columns={[
        {
          label: "Role",
          render: (v) => (
            <Link
              className="block min-w-48 font-medium hover:text-primary hover:underline"
              to={`/vacancies/${v.id}/edit`}
            >
              {v.role_title}
            </Link>
          ),
        },
        {
          label: "Competency expectations",
          render: (v) => (
            <p className="max-w-sm line-clamp-2 text-muted-foreground">
              {v.competency_expectations || "Not specified"}
            </p>
          ),
        },
        {
          label: "Updated",
          render: (v) => (
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {v.updated_at
                ? new Date(v.updated_at).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </span>
          ),
        },
        {
          label: "Actions",
          render: (v) => (
            <Link
              className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium hover:text-primary"
              aria-label={`Edit requirements for ${v.role_title}`}
              to={`/vacancies/${v.id}/edit`}
            >
              Edit requirements
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ),
        },
      ]}
    />
  );
}
