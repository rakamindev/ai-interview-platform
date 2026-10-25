import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, RefreshCw, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ComparisonTable from '@/components/fitgap/ComparisonTable';
import { portfoliosApi } from '@/services/portfolios';
import { sessionsApi } from '@/services/sessions';
import type { FitGapReport, Portfolio } from '@/types';

const busy = (report: FitGapReport | null) => !!report && ['pending', 'generating'].includes(report.generation_status);

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [report, setReport] = useState<FitGapReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'json' | null>(null);
  const [retry, setRetry] = useState(0);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const routeVersion = useRef(0);
  const active = busy(report);
  const back = `/assessments/${id}/sessions/${sessionId}/portfolio`;
  const transcript = `/assessments/${id}/sessions/${sessionId}/transcript`;

  useEffect(() => {
    const version = ++routeVersion.current;
    let cancelled = false;
    setLoading(true); setError(null); setActionError(null); setReport(null); setPortfolio(null); setSubmitting(false); setExporting(null);
    async function load() {
      try {
        const response = await sessionsApi.getPortfolio(Number(sessionId));
        const data = response.data as { portfolio?: Portfolio };
        if (!data.portfolio || data.portfolio.generation_status !== 'complete') {
          throw new Error('portfolio_not_ready');
        }
        if (cancelled) return;
        const found = data.portfolio;
        setPortfolio(found);
        let comparison;
        try {
          comparison = await portfoliosApi.getFitGap(found.id, Number(vacancyId));
        } catch (failure) {
          if ((failure as { response?: { status?: number } }).response?.status !== 404) throw failure;
          if (cancelled) return;
          comparison = await portfoliosApi.triggerFitGap(found.id, Number(vacancyId));
        }
        if (!cancelled && version === routeVersion.current) setReport(comparison.data.report);
      } catch (failure) {
        if (!cancelled) setError(failure instanceof Error && failure.message === 'portfolio_not_ready'
          ? 'The portfolio is not ready for comparison. Return to the portfolio to check its status.'
          : 'We could not load this comparison. Check your connection and try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [sessionId, vacancyId, retry]);

  useEffect(() => {
    if (!active || !portfolio) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    async function poll() {
      if (Date.now() - started > 125000) {
        if (!cancelled) setActionError('This is taking longer than expected. Check status or retry the comparison.');
        return;
      }
      try {
        const response = await portfoliosApi.getFitGap(portfolio!.id, Number(vacancyId));
        if (cancelled) return;
        setReport(response.data.report);
        if (busy(response.data.report)) timer = setTimeout(poll, 2000);
      } catch {
        if (!cancelled) setActionError('We could not check progress. Your previous comparison is preserved. Check status to reconnect.');
      }
    }
    timer = setTimeout(poll, 1500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [active, portfolio?.id, vacancyId]);

  async function regenerate() {
    if (!portfolio) return;
    const version = routeVersion.current;
    setSubmitting(true); setActionError(null);
    try {
      const response = await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      if (version === routeVersion.current) setReport(response.data.report);
    } catch {
      if (version === routeVersion.current) setActionError('We could not request a new comparison. Your previous report has been preserved. Try again.');
    } finally { if (version === routeVersion.current) setSubmitting(false); }
  }

  async function exportReport(format: 'pdf' | 'json') {
    if (!portfolio) return;
    const version = routeVersion.current;
    setExporting(format); setActionError(null);
    try {
      const response = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
      if (version !== routeVersion.current) return;
      const blob = format === 'pdf' ? new Blob([response.data], { type: 'application/pdf' })
        : new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `fitgap-${sessionId}-${vacancyId}.${format}`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      if (version === routeVersion.current) setActionError('The export could not be downloaded. The report may have changed; check status before trying again.');
    } finally { if (version === routeVersion.current) setExporting(null); }
  }

  const current = report?.generation_status === 'complete';
  const summary = report?.summary;
  const hasSnapshot = !!report?.generated_at;
  const comparisons = report?.skill_comparisons ?? [];
  const visibleComparisons = attentionOnly ? comparisons.filter(c => c.result === 'gap' || c.result === 'not_assessed' || (c.rating_source === 'ai' && c.confidence === 'low')) : comparisons;
  const timestamp = report?.generated_at ? new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  }).format(new Date(report.generated_at)) + ' WIB' : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10 text-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link to={back} className="inline-flex items-center gap-2 rounded-sm text-slate-600 hover:text-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to portfolio</Link>
        <Link to={transcript} className="inline-flex items-center gap-2 rounded-sm text-teal-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"><FileText className="h-4 w-4" aria-hidden="true" />View transcript</Link>
      </div>

      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <p className="mb-1 text-sm font-medium text-teal-800">Fit/gap review</p>
          <h1 className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-3xl">{portfolio?.candidate_name || 'Candidate skill comparison'}</h1>
          {report && <p className="mt-2 text-sm text-slate-600 [overflow-wrap:anywhere]">Compared with <span className="font-medium text-slate-800">{report.role_title}</span></p>}
          {timestamp && <p className="mt-1 text-xs text-slate-600">{current ? 'Updated' : 'Previous comparison from'} {timestamp}</p>}
        </div>
        {portfolio && <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void regenerate()} disabled={submitting || active} className="text-slate-700">
            {submitting || active ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />}Refresh comparison
          </Button>
          {(['pdf', 'json'] as const).map(format => <Button key={format} size="sm" variant="outline" disabled={!current || !!exporting || !!actionError} onClick={() => void exportReport(format)} aria-label={`Download ${format.toUpperCase()}`}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />{exporting === format ? 'Downloading...' : format.toUpperCase()}
          </Button>)}
        </div>}
      </header>

      {loading && <div role="status" className="rounded-lg border bg-slate-50 px-6 py-12 text-center text-sm text-slate-600"><Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" aria-hidden="true" />Loading comparison...</div>}
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5"><h2 className="font-semibold text-red-900">Comparison unavailable</h2><p className="mt-2 text-sm text-red-900">{error}</p><Button className="mt-4 bg-teal-800 text-white hover:bg-teal-900" onClick={() => setRetry(value => value + 1)}>Try loading again</Button></div>}
      {actionError && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"><p>{actionError}</p><Button variant="outline" className="mt-3 border-amber-400 bg-white" onClick={() => setRetry(value => value + 1)}>Check status</Button></div>}
      {report && !loading && <>
        {active && <div role="status" className="flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50 p-5 text-teal-900"><Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" aria-hidden="true" /><div><p className="font-semibold">Preparing your comparison</p><p className="mt-1 text-sm">Checking role requirements against the latest ratings.{hasSnapshot ? ' The previous comparison is shown below until the refresh completes.' : ' This page will update automatically.'}</p></div></div>}
        {report.generation_status === 'failed' && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-900"><h2 className="font-semibold">Comparison could not be completed</h2><p className="mt-2 text-sm">{report.error_code === 'queue_unavailable' ? 'The processing queue is unavailable.' : report.error_code === 'generation_timeout' ? 'The comparison timed out.' : 'Processing stopped before a new comparison was saved.'} {hasSnapshot ? 'Your previous comparison is preserved below.' : 'No candidate ratings have been changed.'}</p><Button variant="outline" className="mt-3 bg-white" onClick={() => void regenerate()} disabled={submitting}>Retry comparison</Button></div>}
        {report.generation_status === 'stale' && <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-950"><h2 className="font-semibold">Ratings or requirements have changed</h2><p className="mt-2 text-sm">This is a previous comparison. Refresh it to include the latest human reviews and role requirements. Exports are available once it is current.</p></div>}

        {hasSnapshot && summary && <>
          <section aria-labelledby="coverage-heading" className="overflow-hidden rounded-xl border border-slate-200">
            <div className="border-l-4 border-teal-700 bg-slate-50 p-5 sm:p-6">
              <h2 id="coverage-heading" className="text-lg font-semibold">{summary.assessed_count} of {summary.total_requirements} requirements assessed</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{summary.not_assessed_count ? `${summary.not_assessed_count} requirement${summary.not_assessed_count === 1 ? ' needs' : 's need'} more evidence. An unassessed skill is not a demonstrated gap.` : summary.total_requirements ? 'Each requirement has a rating. Review confidence and supporting evidence before making a decision.' : 'This vacancy needs skill requirements before a meaningful comparison can be made.'}</p>
              <p className="mt-2 text-xs text-slate-600">{summary.reviewed_count} human reviewed{summary.low_confidence_count ? ` · ${summary.low_confidence_count} low-confidence rating${summary.low_confidence_count === 1 ? '' : 's'} to verify` : ''}{!current ? ' · Previous snapshot' : ''}</p>
            </div>
            <dl className="grid grid-cols-2 divide-x divide-slate-200 border-t bg-white sm:grid-cols-4">
              {[
                ['Match', summary.match_count], ['Exceeds', summary.exceed_count], ['Gap', summary.gap_count], ['Not assessed', summary.not_assessed_count],
              ].map(([label, count]) => <div key={label} className="px-5 py-4"><dt className="text-xs text-slate-600">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{count}</dd></div>)}
            </dl>
          </section>

          <section aria-labelledby="comparison-heading" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-5">
              <div><h2 id="comparison-heading" className="font-semibold">Requirement by requirement</h2><p className="mt-1 text-xs text-slate-600">{current ? 'Required level compared with the latest observed rating.' : 'Saved requirements and ratings from the previous comparison.'}</p></div>
              {comparisons.length > 0 && <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700"><input type="checkbox" checked={attentionOnly} onChange={event => setAttentionOnly(event.target.checked)} className="h-4 w-4 accent-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" />Needs follow-up only</label>}
            </div>
            {attentionOnly && !visibleComparisons.length ? <p className="p-6 text-sm text-slate-600">No requirements need follow-up in this comparison.</p> : <ComparisonTable comparisons={visibleComparisons} />}
          </section>

          <section className="grid gap-5 border-t border-slate-200 pt-6 sm:grid-cols-[1fr_2fr]" aria-labelledby="review-note-heading">
            <h2 id="review-note-heading" className="font-semibold">Before you decide</h2>
            <div className="space-y-3 text-sm leading-relaxed text-slate-600"><p>{report.overall_narrative}</p><p>Levels describe the evidence observed in this interview. They do not establish culture fit or an automatic hiring decision. Human-reviewed ratings retain their original AI level for context.</p><Link to={back} className="inline-block rounded-sm font-medium text-teal-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700">Review or revise ratings in the portfolio</Link></div>
          </section>
        </>}
      </>}
    </div>
  );
}
