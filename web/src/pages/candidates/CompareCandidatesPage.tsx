import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { parseLevel } from "@/utils/constants";
import { Scale } from "lucide-react";
import type { Session, Portfolio, Vacancy } from "@/types";

interface CandidateResult {
  session: Session;
  portfolio: Portfolio | null;
}

export default function CompareCandidatesPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const sessionIdsParam = searchParams.get("session_ids") || "";
  const sessionIds = sessionIdsParam
    .split(",")
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0);

  const [candidates, setCandidates] = useState<CandidateResult[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancyId, setSelectedVacancyId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (sessionIds.length === 0) {
        if (isMounted) {
          setLoading(false);
          setCandidates([]);
        }
        return;
      }

      setLoading(true);
      setError(false);

      try {
        // Fetch vacancies safely
        const vRes = await vacanciesApi.list().catch(() => ({ data: { vacancies: [] } }));
        const fetchedVacancies = vRes.data?.vacancies || [];

        // Fetch each candidate session & portfolio safely (don't reject all if one session fails)
        const candidateResults = await Promise.all(
          sessionIds.map(async (sid) => {
            try {
              const sRes = await sessionsApi.get(sid);
              if (!sRes.data?.session) return null;

              let portfolio: Portfolio | null = null;
              try {
                const pRes = await sessionsApi.getPortfolio(sid);
                portfolio = (pRes.data as any)?.portfolio ?? null;
              } catch {
                // portfolio not generated or failed
              }

              return {
                session: sRes.data.session,
                portfolio,
              };
            } catch {
              return null;
            }
          })
        );

        if (!isMounted) return;

        const validCandidates = candidateResults.filter(
          (c): c is CandidateResult => c !== null
        );

        setVacancies(fetchedVacancies);
        if (fetchedVacancies.length > 0) {
          setSelectedVacancyId(String(fetchedVacancies[0].id));
        }
        setCandidates(validCandidates);
      } catch {
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [sessionIdsParam]);

  if (loading) return <LoadingState rows={5} />;

  if (error || candidates.length === 0) {
    return (
      <ErrorState
        title="No candidates selected for comparison"
        message="Select at least 2 candidate sessions from the Candidates page to compare side-by-side."
        onRetry={() => navigate("/candidates")}
      />
    );
  }

  const selectedVacancy = vacancies.find((v) => String(v.id) === selectedVacancyId);

  const allSkillLabels = Array.from(
    new Set([
      ...(selectedVacancy?.skills?.map((s) => s.skill_label).filter(Boolean) || []),
      ...candidates.flatMap(
        (c) => c.portfolio?.skills?.map((s) => s.skill_label).filter(Boolean) || []
      ),
    ])
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compare Candidates"
        description={`Side-by-side competency benchmarking for ${candidates.length} candidate${candidates.length > 1 ? "s" : ""}.`}
        backHref="/candidates"
        backLabel="Candidates"
      />

      {/* Target Vacancy Benchmark Selector */}
      {vacancies.length > 0 && (
        <Card className="p-4 bg-muted/20 border shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-foreground">Target Role Benchmark</h4>
              <p className="text-xs text-muted-foreground">
                Select a vacancy to compare each candidate's evaluated level against required expectations.
              </p>
            </div>
            <Select value={selectedVacancyId} onValueChange={setSelectedVacancyId}>
              <SelectTrigger className="w-full sm:w-64 text-xs">
                <SelectValue placeholder="Select target vacancy..." />
              </SelectTrigger>
              <SelectContent>
                {vacancies.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)} className="text-xs">
                    {v.role_title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>
      )}

      {/* Side-by-Side Comparison Matrix */}
      <Card className="shadow-xs overflow-hidden">
        <CardHeader className="p-4 pb-3 border-b bg-muted/30">
          <CardTitle className="text-xs font-semibold flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            <span>Competency Comparison Grid</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {allSkillLabels.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No skills assessed yet for the selected candidates or vacancy benchmark.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                    <th className="py-3 px-4 min-w-[200px]">Competency</th>
                    {selectedVacancy && (
                      <th className="py-3 px-4 min-w-[140px] bg-primary/5 text-primary">
                        Vacancy Target
                      </th>
                    )}
                    {candidates.map((c) => (
                      <th key={c.session.id} className="py-3 px-4 min-w-[180px]">
                        <div className="font-bold text-foreground">
                          {c.session.candidate_name || `Candidate #${c.session.id}`}
                        </div>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          Session #{c.session.id}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allSkillLabels.map((skillLabel) => {
                    const vacancySkill = selectedVacancy?.skills?.find(
                      (vs) => vs.skill_label?.toLowerCase() === skillLabel.toLowerCase()
                    );
                    const requiredLevel = vacancySkill?.expected_level;

                    return (
                      <tr key={skillLabel} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 font-semibold text-foreground">
                          {skillLabel}
                        </td>

                        {/* Vacancy Target Column */}
                        {selectedVacancy && (
                          <td className="py-3 px-4 bg-primary/5 font-mono text-primary font-bold">
                            {requiredLevel ? `L${requiredLevel}` : "—"}
                          </td>
                        )}

                        {/* Candidate Columns */}
                        {candidates.map((c) => {
                          const candSkill = c.portfolio?.skills?.find(
                            (ps) => ps.skill_label?.toLowerCase() === skillLabel.toLowerCase()
                          );
                          const override = c.portfolio?.overrides?.find(
                            (o) => o.portfolio_skill_id === candSkill?.id
                          );
                          const actualLevel =
                            override?.override_level ??
                            (candSkill ? parseLevel(candSkill.ai_level) : null);

                          const delta =
                            actualLevel !== null && requiredLevel !== undefined
                              ? actualLevel - requiredLevel
                              : null;

                          return (
                            <td key={c.session.id} className="py-3 px-4">
                              {actualLevel !== null ? (
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold px-2 py-0.5 rounded bg-muted border text-xs">
                                    L{actualLevel}
                                  </span>
                                  {delta !== null && (
                                    <span className="text-[10px] font-semibold">
                                      {delta === 0 && (
                                        <span className="text-emerald-600 dark:text-emerald-400">
                                          Match
                                        </span>
                                      )}
                                      {delta > 0 && (
                                        <span className="text-teal-600 dark:text-teal-400">
                                          +{delta}
                                        </span>
                                      )}
                                      {delta < 0 && (
                                        <span className="text-amber-600 dark:text-amber-400">
                                          {delta}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-[11px] italic">
                                  Not assessed
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
