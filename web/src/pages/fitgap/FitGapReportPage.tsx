import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  Clock,
  Download,
  ListChecks,
  Loader2,
  RefreshCw,
  SearchX,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import FitGapSummary from "@/components/fitgap/FitGapSummary";
import NarrativeCard from "@/components/fitgap/NarrativeCard";
import { useFitGapReport } from "@/hooks/useFitGapReport";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { cn } from "@/lib/utils";
import type { Portfolio } from "@/types";

type Tone = "info" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-900",
};

function Banner({ tone, icon, title, children, action }: {
  tone: Tone;
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center", TONES[tone])}
    >
      <div className="flex flex-1 gap-2.5">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{title}</p>
          {children && <p className="text-xs leading-relaxed opacity-90">{children}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function EmptyState({ icon, title, children, action }: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center">
      <div className="mb-3 rounded-full bg-muted p-3 text-muted-foreground">{icon}</div>
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="rounded-xl border" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-4 last:border-0">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-2.5 w-36 sm:block" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{ id: string; sessionId: string; vacancyId: string }>();
  const portfolioPath = `/assessments/${id}/sessions/${sessionId}/portfolio`;

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [portfolioState, setPortfolioState] = useState<"loading" | "ready" | "unavailable" | "not_found">("loading");
  const [roleTitle, setRoleTitle] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then((res) => {
        if (!active) return;
        const data = res.data as { portfolio?: Portfolio };
        if (data.portfolio?.generation_status === "complete") {
          setPortfolio(data.portfolio);
          setPortfolioState("ready");
        } else {
          setPortfolioState("unavailable");
        }
      })
      .catch((error) => {
        if (!active) return;
        // 404 covers both "does not exist" and "belongs to another organization"; we don't say which.
        setPortfolioState(error?.response?.status === 404 ? "not_found" : "unavailable");
      });
    vacanciesApi
      .get(Number(vacancyId))
      .then((res) => active && setRoleTitle(res.data.vacancy.role_title))
      .catch(() => undefined); // title is decorative; the report still works without it
    return () => {
      active = false;
    };
  }, [sessionId, vacancyId]);

  const fitGap = useFitGapReport(portfolio?.id ?? null, Number(vacancyId));
  const { report, phase } = fitGap;
  const rows = report?.skill_comparisons ?? [];
  const hasRows = rows.length > 0;
  const working = phase === "loading" || phase === "generating";

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setExportError(null);
    try {
      const res = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
      const blob =
        format === "pdf"
          ? new Blob([res.data as BlobPart], { type: "application/pdf" })
          : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitgap-${sessionId}-${vacancyId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const header = (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-2">
        <Link
          to={portfolioPath}
          aria-label="Back to portfolio"
          className="mt-1 rounded text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-tight">Fit/Gap Report</h1>
          {roleTitle && <p className="truncate text-sm text-muted-foreground" title={roleTitle}>{roleTitle}</p>}
        </div>
      </div>

      {portfolio && (
        <div className="flex gap-2 pl-6 sm:pl-0">
          <Button variant="outline" size="sm" onClick={fitGap.regenerate} disabled={working}>
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", working && "animate-spin")} aria-hidden />
            {working ? "Updating…" : "Regenerate"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={phase !== "ready" || !!exporting}>
                {exporting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                )}
                Export
                <ChevronDown className="ml-1 h-3.5 w-3.5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => handleExport("pdf")}>PDF document</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleExport("json")}>JSON data</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </header>
  );

  let content: ReactNode;

  if (portfolioState === "loading" || (phase === "loading" && !report)) {
    content = (
      <div className="space-y-6" aria-busy>
        <Skeleton className="h-28 w-full rounded-xl" />
        <RowsSkeleton />
      </div>
    );
  } else if (portfolioState === "not_found") {
    content = (
      <EmptyState
        icon={<SearchX className="h-5 w-5" />}
        title="This report isn't available"
        action={<Link to="/assessments" className="text-sm font-medium text-primary hover:underline">Back to assessments</Link>}
      >
        The candidate session doesn't exist or isn't shared with your organization.
      </EmptyState>
    );
  } else if (portfolioState === "unavailable" || phase === "not_ready") {
    content = (
      <EmptyState
        icon={<Clock className="h-5 w-5" />}
        title="The portfolio isn't ready yet"
        action={<Link to={portfolioPath} className="text-sm font-medium text-primary hover:underline">Go to portfolio</Link>}
      >
        A fit/gap report compares the finished skill portfolio against the vacancy. Come back once the portfolio has been
        generated.
      </EmptyState>
    );
  } else if (phase === "error" && !report) {
    content = (
      <EmptyState
        icon={<AlertTriangle className="h-5 w-5" />}
        title="Couldn't load this report"
        action={<Button size="sm" onClick={fitGap.checkAgain}>Try again</Button>}
      >
        {fitGap.error}
      </EmptyState>
    );
  } else {
    content = (
      <div className="space-y-6">
        <div aria-live="polite" className="space-y-3 empty:hidden">
          {phase === "generating" && hasRows && (
            <Banner
              tone="info"
              icon={<Loader2 className="h-4 w-4 animate-spin" />}
              title={report?.stale ? "A rating changed — updating the report" : "Updating the report"}
            >
              You're seeing the previous version until the new one is ready.
            </Banner>
          )}
          {phase === "ready" && report?.stale && (
            <Banner
              tone="warning"
              icon={<RefreshCw className="h-4 w-4" />}
              title="This report is outdated"
              action={<Button size="sm" variant="outline" onClick={fitGap.regenerate}>Refresh</Button>}
            >
              Ratings or vacancy requirements changed after it was generated.
            </Banner>
          )}
          {phase === "failed" && (
            <Banner
              tone="danger"
              icon={<AlertTriangle className="h-4 w-4" />}
              title={report?.error_message ?? "We could not generate this report."}
              action={<Button size="sm" onClick={fitGap.regenerate}>Try again</Button>}
            >
              {hasRows ? "Showing the last successful version below." : "Nothing was changed. You can safely retry."}
            </Banner>
          )}
          {phase === "timeout" && (
            <Banner
              tone="warning"
              icon={<Clock className="h-4 w-4" />}
              title="This is taking longer than usual"
              action={<Button size="sm" variant="outline" onClick={fitGap.checkAgain}>Check again</Button>}
            >
              The report is still being generated. You can leave this page and come back later.
            </Banner>
          )}
          {phase === "error" && report && (
            <Banner tone="danger" icon={<AlertTriangle className="h-4 w-4" />} title={fitGap.error ?? "Something went wrong."}
              action={<Button size="sm" variant="outline" onClick={fitGap.checkAgain}>Try again</Button>} />
          )}
          {exportError && <Banner tone="danger" icon={<AlertTriangle className="h-4 w-4" />} title={exportError} />}
        </div>

        {phase === "generating" && !hasRows && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-4">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium">Comparing the portfolio with the vacancy…</p>
                <p className="text-xs text-muted-foreground">Usually takes a few seconds.</p>
              </div>
            </div>
            <RowsSkeleton />
          </div>
        )}

        {report && hasRows && (
          <>
            <div className="rounded-xl border bg-card p-4 sm:p-5">
              <FitGapSummary summary={report.summary} />
            </div>
            <ComparisonTable comparisons={rows} busy={phase === "generating"} />
            <NarrativeCard report={report} />
          </>
        )}

        {report && !hasRows && phase === "ready" && (
          <EmptyState
            icon={<ListChecks className="h-5 w-5" />}
            title="This vacancy has no required skills"
            action={
              <Link to={`/vacancies/${vacancyId}/edit`} className="text-sm font-medium text-primary hover:underline">
                Add required skills
              </Link>
            }
          >
            Add the skills and levels this role needs, then come back to compare the candidate.
          </EmptyState>
        )}

        {portfolio && phase === "ready" && portfolio.skills.some((s) => s.is_discovered) && (
          <section aria-labelledby="discovered-title" className="rounded-xl border bg-card p-4 sm:p-5">
            <h2 id="discovered-title" className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
              <Zap className="h-4 w-4 text-amber-500" aria-hidden />
              Also observed
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">Skills that came up in the interview but aren't required for this role.</p>
            <ul className="space-y-2">
              {portfolio.skills
                .filter((s) => s.is_discovered)
                .map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-2 text-sm">
                    <span className="font-medium break-words">{s.skill_label}</span>
                    <span className="text-xs text-muted-foreground">
                      L{s.ai_level} · {s.ai_confidence?.toLowerCase() === "low" ? "limited evidence" : `${s.ai_confidence} confidence`}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {report?.generated_at && hasRows && (
          <p className="text-center text-[11px] text-muted-foreground">
            Generated {dateFormat.format(new Date(report.generated_at))}. Levels are compared by fixed rules; assessor
            overrides take precedence over AI ratings.
          </p>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto max-w-3xl space-y-6 pb-10">
        {header}
        {content}
      </div>
    </TooltipProvider>
  );
}
