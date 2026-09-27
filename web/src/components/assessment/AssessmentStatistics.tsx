
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  Radio,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

import type { AssessmentSessionCounts } from "@/services/assessments";

interface AssessmentStatisticsProps {
  totalAssessments: number | null;
  sessionCounts?: AssessmentSessionCounts;
  loading?: boolean;
  isSearching?: boolean;
}

interface StatItem {
  key: string;
  label: string;
  description: string;
  value: number | null;
  icon: LucideIcon;
  iconBackground: string;
  iconColor: string;
}

function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function StatisticCard({
  item,
  loading,
}: {
  item: StatItem;
  loading: boolean;
}) {
  const Icon = item.icon;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">
          {item.label}
        </p>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.iconBackground}`}
        >
          <Icon className={`h-5 w-5 ${item.iconColor}`} />
        </div>
      </div>

      {loading ? (
        <Skeleton className="mt-4 h-9 w-20" />
      ) : (
        <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
          {item.value ?? "—"}
        </p>
      )}

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {item.description}
      </p>
    </div>
  );
}

export default function AssessmentStatistics({
  totalAssessments,
  sessionCounts,
  loading = false,
  isSearching = false,
}: AssessmentStatisticsProps) {
  const counts = sessionCounts?.by_status ?? {};

  const items: StatItem[] = [
    {
      key: "assessments",
      label: isSearching
        ? "Matching Assessments"
        : "Total Assessments",
      description: isSearching
        ? "Assessments matching your search"
        : "Assessments in your workspace",
      value: totalAssessments,
      icon: ClipboardList,
      iconBackground: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      key: "pending",
      label: "Awaiting Candidate",
      description: "Sessions waiting to start",
      value: sessionCounts ? counts.pending ?? 0 : null,
      icon: UsersRound,
      iconBackground: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    {
      key: "active",
      label: "In Progress",
      description: "Active interview sessions",
      value: sessionCounts ? counts.active ?? 0 : null,
      icon: Radio,
      iconBackground: "bg-sky-50",
      iconColor: "text-sky-600",
    },
    {
      key: "ended",
      label: "Ended",
      description: "Finished sessions",
      value: sessionCounts ? counts.ended ?? 0 : null,
      icon: CheckCircle2,
      iconBackground: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
  ];

  const knownStatuses = new Set([
    "pending",
    "active",
    "ended",
  ]);

  const additionalStatuses: StatItem[] = Object.entries(counts)
    .filter(([status]) => !knownStatuses.has(status))
    .map(([status, value]) => ({
      key: status,
      label: formatStatus(status),
      description: "Interview sessions",
      value,
      icon: Clock3,
      iconBackground: "bg-slate-100",
      iconColor: "text-slate-600",
    }));

  return (
    <section
      aria-label="Assessment statistics"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {[...items, ...additionalStatuses].map((item) => (
        <StatisticCard
          key={item.key}
          item={item}
          loading={loading}
        />
      ))}
    </section>
  );
}
