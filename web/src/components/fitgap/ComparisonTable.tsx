import {
  LEVEL_LABELS,
  FIT_GAP_RESULT_LABELS,
  FIT_GAP_RESULT_CLASSES,
} from "@/utils/constants";
import { cn } from "@/lib/utils";
import type { SkillComparison } from "@/types";
import {
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Minus,
  PencilLine,
  Target,
  ArrowUpRight,
} from "lucide-react";

interface ComparisonTableProps {
  comparisons: SkillComparison[];
}

function ResultBadge({ comparison }: { comparison: SkillComparison }) {
  const label = FIT_GAP_RESULT_LABELS[comparison.result];
  const classes = FIT_GAP_RESULT_CLASSES[comparison.result];

  const Icon =
    comparison.result === "match"
      ? CheckCircle2
      : comparison.result === "exceed"
        ? TrendingUp
        : comparison.result === "gap"
          ? AlertTriangle
          : Minus;

  let suffix = "";

  if (comparison.result === "exceed" && comparison.delta) {
    suffix = ` +${comparison.delta}`;
  } else if (comparison.result === "gap" && comparison.delta) {
    suffix = ` -${Math.abs(comparison.delta)}`;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        classes,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        {label}
        {suffix}
      </span>
    </span>
  );
}

function SummaryCard({
  label,
  count,
  description,
  icon: Icon,
  iconClass,
}: {
  label: string;
  count: number;
  description: string;
  icon: typeof Target;
  iconClass: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border bg-card p-4">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          iconClass,
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>

      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tracking-tight">
          {count}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default function ComparisonTable({
  comparisons,
}: ComparisonTableProps) {
  const matchCount = comparisons.filter(
    (comparison) => comparison.result === "match",
  ).length;

  const gapCount = comparisons.filter(
    (comparison) => comparison.result === "gap",
  ).length;

  const exceedCount = comparisons.filter(
    (comparison) => comparison.result === "exceed",
  ).length;

  const totalCount = comparisons.length;

  if (totalCount === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Target
            className="h-6 w-6 text-muted-foreground"
            aria-hidden="true"
          />
        </div>

        <h3 className="mt-4 text-sm font-semibold">
          Belum ada data perbandingan
        </h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Data kecocokan kompetensi akan ditampilkan setelah analisis tersedia.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          label="Kompetensi sesuai"
          count={matchCount}
          description="Memenuhi level yang dibutuhkan"
          icon={CheckCircle2}
          iconClass="bg-emerald-50 text-emerald-600"
        />

        <SummaryCard
          label="Perlu dikembangkan"
          count={gapCount}
          description="Masih di bawah persyaratan"
          icon={AlertTriangle}
          iconClass="bg-amber-50 text-amber-600"
        />

        <SummaryCard
          label="Melebihi persyaratan"
          count={exceedCount}
          description="Level di atas kebutuhan posisi"
          icon={TrendingUp}
          iconClass="bg-sky-50 text-sky-600"
        />
      </div>

      {/* Comparison table */}
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-2 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h3 className="font-semibold tracking-tight">
              Perbandingan Kompetensi
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Bandingkan level yang dibutuhkan dengan level kandidat.
            </p>
          </div>

          <span className="inline-flex w-fit items-center rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            {totalCount} kompetensi
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th
                  scope="col"
                  className="px-5 py-3.5 text-left font-medium text-muted-foreground"
                >
                  Kompetensi
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-center font-medium text-muted-foreground"
                >
                  Level dibutuhkan
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-center font-medium text-muted-foreground"
                >
                  Level kandidat
                </th>
                <th
                  scope="col"
                  className="px-5 py-3.5 text-center font-medium text-muted-foreground"
                >
                  Hasil analisis
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {comparisons.map((comparison, index) => (
                <tr
                  key={`${comparison.skill_label}-${index}`}
                  className="transition-colors hover:bg-muted/20"
                >
                  <td className="px-5 py-4">
                    <span className="font-medium">
                      {comparison.skill_label}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-center text-muted-foreground">
                    {LEVEL_LABELS[comparison.expected_level]}
                  </td>

                  <td className="px-4 py-4 text-center">
                    {comparison.candidate_level != null ? (
                      <span className="inline-flex items-center justify-center gap-1.5 font-medium">
                        {LEVEL_LABELS[comparison.candidate_level]}

                        {comparison.is_override && (
                          <span
                            title="Level telah disesuaikan secara manual"
                            aria-label="Level disesuaikan secara manual"
                          >
                            <PencilLine className="h-3.5 w-3.5 text-muted-foreground" />
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Belum dinilai</span>
                    )}
                  </td>

                  <td className="px-5 py-4 text-center">
                    <ResultBadge comparison={comparison} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p>
            Menampilkan {totalCount} kompetensi yang dianalisis.
          </p>

          <p className="inline-flex items-center gap-1.5">
            <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
            Level yang disesuaikan secara manual ditandai dengan ikon pensil.
          </p>
        </div>
      </section>
    </div>
  );
}
