import { cn } from '@/lib/utils';
import type { SkillComparison } from '@/types';

const results = {
  match: { label: 'Match', classes: 'bg-teal-50 text-teal-800 border-teal-200' },
  exceed: { label: 'Exceeds', classes: 'bg-teal-50 text-teal-800 border-teal-200' },
  gap: { label: 'Gap', classes: 'bg-amber-50 text-amber-900 border-amber-200' },
  not_assessed: { label: 'Not assessed', classes: 'bg-slate-100 text-slate-700 border-slate-200' },
};

export default function ComparisonTable({ comparisons }: { comparisons: SkillComparison[] }) {
  if (!comparisons.length) return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <h3 className="font-semibold">No skill requirements</h3>
      <p className="mt-2 text-sm text-slate-600">Add requirements to this vacancy, then refresh the comparison.</p>
    </div>
  );

  return (
    <table className="w-full table-fixed text-sm">
      <caption className="sr-only">Role requirements compared with observed candidate skills and rating sources</caption>
      <thead className="hidden border-b bg-slate-50 text-slate-600 md:table-header-group">
        <tr>
          <th scope="col" className="w-[43%] px-5 py-3 text-left font-medium">Skill &amp; evidence</th>
          <th scope="col" className="w-[14%] px-3 py-3 text-left font-medium">Required</th>
          <th scope="col" className="w-[25%] px-3 py-3 text-left font-medium">Observed</th>
          <th scope="col" className="w-[18%] px-3 py-3 text-left font-medium">Comparison</th>
        </tr>
      </thead>
      <tbody className="block md:table-row-group">
        {comparisons.map((comparison, index) => {
          const result = results[comparison.result];
          return (
            <tr key={comparison.requirement_id ?? index} className="grid grid-cols-2 border-b last:border-0 md:table-row">
              <td className="col-span-2 min-w-0 px-5 pb-2 pt-5 align-top md:table-cell md:py-5">
                <p className="font-semibold text-slate-900 [overflow-wrap:anywhere]">{comparison.skill_label}</p>
                {comparison.candidate_level != null ? (
                  <details className="mt-2 text-slate-600 [overflow-wrap:anywhere]">
                    <summary className="cursor-pointer rounded-sm text-xs font-medium text-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700">
                      Read evidence<span className="sr-only"> for {comparison.skill_label}</span>
                    </summary>
                    <div className="mt-3 space-y-3 text-sm leading-relaxed">
                      {comparison.competency_summary && <p>{comparison.competency_summary}</p>}
                      {comparison.evidence?.length ? comparison.evidence.map((quote, i) => (
                        <blockquote key={i} className="border-l-2 border-teal-300 pl-3">{quote}</blockquote>
                      )) : <p>No supporting quotes available. Verify this rating in the transcript.</p>}
                      {comparison.assessor_notes && <p><span className="font-medium">Assessor note: </span>{comparison.assessor_notes}</p>}
                    </div>
                  </details>
                ) : <p className="mt-1 text-xs leading-relaxed text-slate-600">Follow up on this skill; no usable rating is available.</p>}
              </td>
              <td className="px-5 py-3 align-top md:table-cell md:px-3 md:py-5">
                <span className="mb-1 block text-xs text-slate-600 md:hidden">Required</span>
                <span className="font-semibold text-slate-700">{comparison.expected_level == null ? 'Not set' : `L${comparison.expected_level}`}</span>
              </td>
              <td className="min-w-0 px-5 py-3 align-top md:table-cell md:px-3 md:py-5">
                <span className="mb-1 block text-xs text-slate-600 md:hidden">Observed</span>
                {comparison.candidate_level == null ? <span className="text-slate-600">No rating</span> : (
                  <>
                    <span className="font-semibold text-slate-900">L{comparison.candidate_level}</span>
                    {comparison.rating_source === 'assessor' ? (
                      <div className="mt-1 text-xs leading-relaxed text-teal-800">Human reviewed <span className="block text-slate-600">AI: L{comparison.ai_level ?? '?'}</span></div>
                    ) : comparison.rating_source === 'ai' ? <div className="mt-1 text-xs leading-relaxed text-slate-600">AI rating<span className="block">{comparison.confidence || 'Unknown'} confidence</span></div> : <div className="mt-1 text-xs text-slate-600">Source unavailable. Refresh this comparison.</div>}
                  </>
                )}
              </td>
              <td className="col-span-2 px-5 pb-5 pt-1 align-top md:table-cell md:px-3 md:py-5">
                <span className={cn('inline-flex rounded border px-2 py-1 text-xs font-semibold', result.classes)}>{result.label}</span>
                {comparison.delta != null && comparison.delta !== 0 && <p className="mt-1 text-xs text-slate-600">{comparison.delta > 0 ? '+' : ''}{comparison.delta} level{Math.abs(comparison.delta) === 1 ? '' : 's'}</p>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
