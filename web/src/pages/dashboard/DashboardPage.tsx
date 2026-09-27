
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  ChevronRight,
  ClipboardList,
  Clock3,
  Code2,
  Globe2,
  Layers3,
  Plus,
  RefreshCw,
} from "lucide-react";

import { assessmentsApi } from "@/services/assessments";
import { vacanciesApi } from "@/services/vacancies";
import { Button } from "@/components/ui/button";

import type { Assessment, Vacancy } from "@/types";

type DashboardAssessment = Assessment & {
  skillNames: string[];
  skillsLoaded: boolean;
};

type DashboardVacancy = Vacancy & {
  skillNames: string[];
  skillsLoaded: boolean;
};

type DashboardData = {
  assessments: DashboardAssessment[];
  vacancies: DashboardVacancy[];
  totalAssessments: number | null;
  totalVacancies: number | null;
  assessmentsError: boolean;
  vacanciesError: boolean;
};

const initialData: DashboardData = {
  assessments: [],
  vacancies: [],
  totalAssessments: null,
  totalVacancies: null,
  assessmentsError: false,
  vacanciesError: false,
};

function getSkillNames(skills: unknown): string[] {
  if (!Array.isArray(skills)) {
    return [];
  }

  return skills
    .map((skill: unknown) => {
      if (typeof skill === "string") {
        return skill.trim();
      }

      if (
        typeof skill !== "object" ||
        skill === null
      ) {
        return "";
      }

      const item = skill as Record<string, unknown>;

      const label =
        item.skill_label ??
        item.name ??
        item.label;

      if (typeof label === "string") {
        return label.trim();
      }

      if (
        typeof item.skill === "object" &&
        item.skill !== null
      ) {
        const nested = item.skill as Record<
          string,
          unknown
        >;

        const nestedLabel =
          nested.skill_label ??
          nested.name;

        return typeof nestedLabel === "string"
          ? nestedLabel.trim()
          : "";
      }

      return "";
    })
    .filter((name): name is string => name.length > 0);
}

function getLanguageLabel(language: string | null | undefined) {
  if (!language) {
    return "Not specified";
  }

  const languages: Record<string, string> = {
    en: "English",
    id: "Indonesian",
    "en-US": "English",
    "id-ID": "Indonesian",
  };

  return languages[language] ?? language;
}

export default function DashboardPage() {
  const navigate = useNavigate();

  const [data, setData] =
    useState<DashboardData>(initialData);

  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      setLoading(true);

      const [assessmentResult, vacancyResult] =
        await Promise.allSettled([
          assessmentsApi.list(1),
          vacanciesApi.list(1),
        ]);

      if (cancelled) {
        return;
      }

      const assessmentList =
        assessmentResult.status === "fulfilled"
          ? assessmentResult.value.data.assessments
          : [];

      const vacancyList =
        vacancyResult.status === "fulfilled"
          ? vacancyResult.value.data.vacancies
          : [];

      const recentAssessmentList =
        assessmentList.slice(0, 5);

      const recentVacancyList =
        vacancyList.slice(0, 4);

      const [
        assessmentDetails,
        vacancyDetails,
      ] = await Promise.all([
        Promise.allSettled(
          recentAssessmentList.map((assessment) =>
            assessmentsApi.get(assessment.id)
          )
        ),
        Promise.allSettled(
          recentVacancyList.map((vacancy) =>
            vacanciesApi.get(vacancy.id)
          )
        ),
      ]);

      if (cancelled) {
        return;
      }

      const assessments: DashboardAssessment[] =
        recentAssessmentList.map(
          (assessment, index) => {
            const result = assessmentDetails[index];

            if (
              result &&
              result.status === "fulfilled"
            ) {
              const detail =
                result.value.data.assessment;

              return {
                ...assessment,
                ...detail,
                skillNames: getSkillNames(
                  detail.skills
                ),
                skillsLoaded: true,
              };
            }

            return {
              ...assessment,
              skillNames: getSkillNames(
                assessment.skills
              ),
              skillsLoaded:
                Array.isArray(assessment.skills),
            };
          }
        );

      const vacancies: DashboardVacancy[] =
        recentVacancyList.map(
          (vacancy, index) => {
            const result = vacancyDetails[index];

            if (
              result &&
              result.status === "fulfilled"
            ) {
              const detail =
                result.value.data.vacancy;

              return {
                ...vacancy,
                ...detail,
                skillNames: getSkillNames(
                  detail.skills
                ),
                skillsLoaded: true,
              };
            }

            return {
              ...vacancy,
              skillNames: getSkillNames(
                vacancy.skills
              ),
              skillsLoaded:
                Array.isArray(vacancy.skills),
            };
          }
        );

      setData({
        assessments,
        vacancies,

        totalAssessments:
          assessmentResult.status === "fulfilled"
            ? assessmentResult.value.data.meta.total_count
            : null,

        totalVacancies:
          vacancyResult.status === "fulfilled"
            ? vacancyResult.value.data.meta.total_count
            : null,

        assessmentsError:
          assessmentResult.status === "rejected",

        vacanciesError:
          vacancyResult.status === "rejected",
      });

      setLoading(false);
    };

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-primary">
            Recruitment workspace
          </p>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Overview
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Your assessments and vacancies in one place.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={refresh}
          disabled={loading}
          className="h-10 rounded-xl border-slate-200 bg-white"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${
              loading ? "animate-spin" : ""
            }`}
          />
          Refresh
        </Button>
      </div>

      <section className="relative overflow-hidden rounded-[24px] bg-primary p-7 text-white shadow-lg shadow-primary/10 sm:p-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-40 h-[390px] w-[390px] rounded-full border-[70px] border-white/10"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 right-[15%] h-[260px] w-[260px] rounded-full border-[55px] border-white/10"
        />

        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">
            <Code2 className="h-4 w-4 text-[#FFE39A]" />
            AI recruitment workspace
          </span>

          <h2 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Better interviews.
            <br />
            <span className="text-[#FFE39A]">
              Smarter hiring.
            </span>
          </h2>

          <p className="mt-4 max-w-xl text-sm leading-7 text-white/85 sm:text-base">
            Create assessments, manage vacancies, and keep
            your recruitment workflow organized.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={() =>
                navigate("/assessments/new")
              }
              className="h-11 rounded-xl bg-white px-5 font-semibold text-primary hover:bg-white/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Assessment
            </Button>

            <Button
              type="button"
              onClick={() =>
                navigate("/vacancies/new")
              }
              variant="outline"
              className="h-11 rounded-xl border-white/30 bg-white/10 px-5 font-semibold text-white hover:bg-white/20 hover:text-white"
            >
              <BriefcaseBusiness className="mr-2 h-4 w-4" />
              New Vacancy
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard
          title="Total Assessments"
          value={data.totalAssessments}
          description="Assessments in your workspace"
          icon={ClipboardList}
          loading={loading}
          href="/assessments"
        />

        <StatCard
          title="Total Vacancies"
          value={data.totalVacancies}
          description="Vacancies in your workspace"
          icon={BriefcaseBusiness}
          loading={loading}
          href="/vacancies"
        />
      </section>

      {(data.assessmentsError ||
        data.vacanciesError) &&
        !loading && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />

              <p className="text-sm text-amber-800">
                Some dashboard information could not be
                loaded.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={refresh}
            >
              Try again
            </Button>
          </div>
        )}

      <div className="grid items-start gap-6 xl:grid-cols-5">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-3">
          <SectionHeader
            title="Recent Assessments"
            description="Your latest assessments"
            href="/assessments"
          />

          {loading ? (
            <CardGridSkeleton count={5} />
          ) : data.assessmentsError ? (
            <ErrorState />
          ) : data.assessments.length === 0 ? (
            <EmptyState
              title="No assessments yet"
              description="Create an assessment to get started."
              href="/assessments/new"
              action="Create Assessment"
            />
          ) : (
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {data.assessments.map((assessment) => (
                <AssessmentCard
                  key={assessment.id}
                  assessment={assessment}
                />
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
          <SectionHeader
            title="Recent Vacancies"
            description="Your latest job vacancies"
            href="/vacancies"
          />

          {loading ? (
            <CardGridSkeleton count={4} />
          ) : data.vacanciesError ? (
            <ErrorState />
          ) : data.vacancies.length === 0 ? (
            <EmptyState
              title="No vacancies yet"
              description="Create a vacancy to get started."
              href="/vacancies/new"
              action="Create Vacancy"
            />
          ) : (
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {data.vacancies.map((vacancy) => (
                <VacancyCard
                  key={vacancy.id}
                  vacancy={vacancy}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function AssessmentCard({
  assessment,
}: {
  assessment: DashboardAssessment;
}) {
  return (
    <Link
      to={`/assessments/${assessment.id}/invite`}
      className="group flex min-h-[260px] flex-col rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ClipboardList className="h-5 w-5" />
        </div>

        {/* {assessment.latest_session?.status ===
        "active" ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            Live interview
          </span>
        ) : (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500">
            Assessment
          </span>
        )} */}
      </div>

      <h3 className="mt-4 line-clamp-2 min-h-10 text-lg font-bold leading-5 text-slate-900 group-hover:text-primary">
        {assessment.name}
      </h3>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" />
          {assessment.time_limit_min} min
        </span>

        <span className="inline-flex items-center gap-1.5">
          <Globe2 className="h-3.5 w-3.5" />
          {getLanguageLabel(assessment.language)}
        </span>
      </div>

      <div className="mt-5 flex-1 border-t border-slate-100 pt-4">
        <SkillGrid
          skills={assessment.skillNames}
          loaded={assessment.skillsLoaded}
          type="assessment"
        />
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          <Layers3 className="h-3.5 w-3.5" />

          {assessment.skillsLoaded
            ? `${assessment.skillNames.length} ${
                assessment.skillNames.length === 1
                  ? "skill"
                  : "skills"
              }`
            : "Skills unavailable"}
        </span>

        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
          View assessment
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function VacancyCard({
  vacancy,
}: {
  vacancy: DashboardVacancy;
}) {
  return (
    <Link
      to={`/vacancies/${vacancy.id}/edit`}
      className="group flex min-h-[260px] flex-col rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BriefcaseBusiness className="h-5 w-5" />
        </div>

        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500">
          Vacancy
        </span>
      </div>

      <h3 className="mt-4 line-clamp-2 min-h-10 text-lg font-bold leading-5 text-slate-900 group-hover:text-primary">
        {vacancy.role_title}
      </h3>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <Layers3 className="h-3.5 w-3.5" />

        {vacancy.skillsLoaded
          ? `${vacancy.skillNames.length} required ${
              vacancy.skillNames.length === 1
                ? "skill"
                : "skills"
            }`
          : "Skills unavailable"}
      </div>

      <div className="mt-5 flex-1 border-t border-slate-100 pt-4">
        <SkillGrid
          skills={vacancy.skillNames}
          loaded={vacancy.skillsLoaded}
          type="vacancy"
        />
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-[11px] text-slate-400">
          Vacancy
        </span>

        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
          View details
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function SkillGrid({
  skills,
  loaded,
  type = "vacancy",
}: {
  skills: string[];
  loaded: boolean;
  type?: "vacancy" | "assessment";
}) {
  if (!loaded) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center">
        <p className="text-xs text-slate-400">
          Skill information unavailable
        </p>
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center">
        <p className="text-xs text-slate-400">
          No skills configured
        </p>
      </div>
    );
  }

  const visibleSkills = skills.slice(0, 4);
  const remaining = skills.length - visibleSkills.length;
  const gridSkill = type === "vacancy" ? "grid grid-rows-2 gap-2" : "grid grid-cols-2 gap-2";

  return (
    <div>
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
        Skills
      </p>

      <div className={gridSkill}>
        {visibleSkills.map((skill, index) => (
          <div
            key={`${skill}-${index}`}
            title={skill}
            className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />

            <span className="truncate text-[11px] font-medium text-slate-700">
              {skill}
            </span>
          </div>
        ))}

        {remaining > 0 && (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-primary/30 bg-primary/5 px-2.5 py-2">
            <span className="text-[11px] font-semibold text-primary">
              +{remaining} more
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  loading,
  href,
}: {
  title: string;
  value: number | null;
  description: string;
  icon: typeof ClipboardList;
  loading: boolean;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="group flex items-start justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <div>
        <p className="text-sm font-medium text-slate-500">
          {title}
        </p>

        {loading ? (
          <div className="mt-4 h-10 w-20 animate-pulse rounded-lg bg-slate-100" />
        ) : (
          <p className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900">
            {value === null ? "—" : value}
          </p>
        )}

        <p className="mt-2 text-xs text-slate-400">
          {description}
        </p>

        <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-primary">
          View all
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </span>
      </div>

      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </div>
    </Link>
  );
}

function SectionHeader({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
      <div>
        <h2 className="text-base font-bold text-slate-900">
          {title}
        </h2>

        <p className="mt-1 text-xs text-slate-500">
          {description}
        </p>
      </div>

      <Link
        to={href}
        className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
      >
        View all
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function CardGridSkeleton({
  count,
}: {
  count: number;
}) {
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="min-h-[260px] animate-pulse rounded-2xl border border-slate-200 p-4"
        >
          <div className="h-11 w-11 rounded-xl bg-slate-100" />

          <div className="mt-5 h-4 w-3/4 rounded bg-slate-100" />

          <div className="mt-3 h-3 w-1/2 rounded bg-slate-100" />

          <div className="mt-7 grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-8 rounded-lg bg-slate-100"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState() {
  return (
    <div className="px-6 py-12 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-500">
        <AlertCircle className="h-5 w-5" />
      </div>

      <p className="mt-3 text-sm font-semibold text-slate-700">
        Unable to load data
      </p>

      <p className="mt-1 text-xs text-slate-500">
        Refresh the dashboard to try again.
      </p>
    </div>
  );
}

function EmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Code2 className="h-6 w-6" />
      </div>

      <p className="text-sm font-bold text-slate-800">
        {title}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {description}
      </p>

      <Link
        to={href}
        className="mt-5 text-sm font-semibold text-primary hover:underline"
      >
        {action}
      </Link>
    </div>
  );
}