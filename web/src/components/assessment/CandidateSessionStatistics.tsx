
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  Radio,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

import type {
  CandidateSessionCounts,
} from "@/services/assessments";

interface CandidateSessionStatisticsProps {
  sessionCounts?: CandidateSessionCounts;
  loading?: boolean;
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
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function StatCard({
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
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            {item.label}
          </p>

          {loading ? (
            <Skeleton className="mt-4 h-9 w-20" />
          ) : (
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
              {item.value ?? "—"}
            </p>
          )}

          <p className="mt-2 text-xs leading-5 text-slate-400">
            {item.description}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.iconBackground}`}
        >
          <Icon
            className={`h-5 w-5 ${item.iconColor}`}
          />
        </div>
      </div>
    </div>
  );
}

export default function CandidateSessionStatistics({
  sessionCounts,
  loading = false,
}: CandidateSessionStatisticsProps) {
  const items: StatItem[] = [
    {
      key: "pending",
      label: "Awaiting Candidate",
      description: "Invited but not started",
      value: sessionCounts?.pending ?? null,
      icon: UsersRound,
      iconBackground: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    {
      key: "active",
      label: "In Progress",
      description: "Active interview sessions",
      value: sessionCounts?.active ?? null,
      icon: Radio,
      iconBackground: "bg-sky-50",
      iconColor: "text-sky-600",
    },
    {
      key: "completed",
      label: "Completed",
      description: "Sessions ended without an error",
      value: sessionCounts?.completed ?? null,
      icon: CheckCircle2,
      iconBackground: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      key: "failed",
      label: "Failed",
      description: "Sessions ended with an error",
      value: sessionCounts?.failed ?? null,
      icon: CircleAlert,
      iconBackground: "bg-red-50",
      iconColor: "text-red-600",
    },
  ];

  const additionalStatuses = Object.entries(
    sessionCounts?.by_status ?? {}
  )
    .filter(
      ([status]) =>
        !["pending", "active", "ended"].includes(
          status
        )
    )
    .map(
      ([status, value]): StatItem => ({
        key: status,
        label: formatStatus(status),
        description: "Interview sessions",
        value,
        icon: Clock3,
        iconBackground: "bg-slate-100",
        iconColor: "text-slate-600",
      })
    );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-900">
          Interview Progress
        </h2>

        <p className="mt-1 text-xs text-slate-500">
          Session status across all candidates in
          this assessment.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...items, ...additionalStatuses].map(
          (item) => (
            <StatCard
              key={item.key}
              item={item}
              loading={loading}
            />
          )
        )}
      </div>
    </section>
  );
}
