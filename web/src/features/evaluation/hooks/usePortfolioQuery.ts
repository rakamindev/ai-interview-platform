import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionsApi } from "../services/sessions";
import { portfoliosApi } from "../services/portfolios";
import { queryKeys } from "@/lib/queryKeys";
import type { Portfolio, AssessorOverride, PortfolioSkill } from "@/types";

export interface PortfolioApiResponse {
  portfolio?: Portfolio;
  status?: string;
  message?: string;
}

export function usePortfolioQuery(sessionId: number | string | undefined) {
  const sId = Number(sessionId);

  return useQuery({
    queryKey: queryKeys.portfolio.bySession(sId),
    queryFn: async (): Promise<PortfolioApiResponse> => {
      const res = await sessionsApi.getPortfolio(sId);
      return res.data as PortfolioApiResponse;
    },
    enabled: !isNaN(sId) && sId > 0,
    refetchInterval: (query) => {
      const data = query.state.data;
      const status = data?.status || data?.portfolio?.generation_status;
      // Auto-poll every 3s if generating or pending
      if (status === "generating" || status === "pending") {
        return 3000;
      }
      return false;
    },
  });
}

export function useSaveOverrideMutation(sessionId: number | string | undefined) {
  const queryClient = useQueryClient();
  const sId = Number(sessionId);

  return useMutation({
    mutationFn: async ({
      skillId,
      overrideLevel,
      notes,
    }: {
      skillId: number;
      overrideLevel: number;
      notes: string;
    }) => {
      const res = await portfoliosApi.getOverride(skillId, {
        override_level: overrideLevel,
        assessor_notes: notes,
      });
      return res.data.override as AssessorOverride;
    },
    // Optimistic Update: instantly update the UI cache before the server responds
    onMutate: async ({ skillId, overrideLevel, notes }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.portfolio.bySession(sId) });

      const previousData = queryClient.getQueryData<PortfolioApiResponse>(
        queryKeys.portfolio.bySession(sId)
      );

      if (previousData?.portfolio) {
        const existingSkills = previousData.portfolio.skills || [];
        const targetSkill = existingSkills.find((s) => s.id === skillId);
        const baseAiLevel = targetSkill
          ? typeof targetSkill.ai_level === "number"
            ? targetSkill.ai_level
            : Number(targetSkill.ai_level) || 0
          : 0;

        const syntheticOverride: AssessorOverride = {
          id: Date.now(),
          portfolio_skill_id: skillId,
          ai_level: baseAiLevel,
          override_level: overrideLevel,
          assessor_notes: notes,
          overridden_by: undefined,
          overridden_at: new Date().toISOString(),
        };

        const updatedSkills = existingSkills.map(
          (skill: PortfolioSkill) => {
            if (skill.id === skillId) {
              return {
                ...skill,
                assessor_override: syntheticOverride,
              };
            }
            return skill;
          }
        );

        const updatedOverrides = [
          ...(previousData.portfolio.overrides || []).filter(
            (o) => o.portfolio_skill_id !== skillId
          ),
          syntheticOverride,
        ];

        queryClient.setQueryData<PortfolioApiResponse>(queryKeys.portfolio.bySession(sId), {
          ...previousData,
          portfolio: {
            ...previousData.portfolio,
            skills: updatedSkills,
            overrides: updatedOverrides,
          },
        });
      }

      // Cross-Feature Real-Time Sync: Recalculate all cached Fit/Gap reports in memory immediately
      const fitgapQueries = queryClient.getQueriesData<any>({ queryKey: queryKeys.fitgap.all });
      const previousFitGapMap: Array<[any, any]> = [];

      for (const [qKey, cachedData] of fitgapQueries) {
        if (!cachedData?.report?.skill_comparisons) continue;
        previousFitGapMap.push([qKey, cachedData]);

        const report = cachedData.report;
        let modified = false;

        const updatedComparisons = report.skill_comparisons.map((sc: any) => {
          // Match by skill ID or skill label
          const previousSkills = previousData?.portfolio?.skills || [];
          const targetSkill = previousSkills.find((s) => s.id === skillId);
          const isMatch =
            (targetSkill?.skill_id && sc.skill_id === targetSkill.skill_id) ||
            (targetSkill?.skill_label &&
              sc.skill_label?.toLowerCase() === targetSkill.skill_label?.toLowerCase()) ||
            sc.skill_id === skillId;

          if (!isMatch) return sc;
          modified = true;

          const expected =
            typeof sc.expected_level === "number"
              ? sc.expected_level
              : Number(sc.expected_level) || 0;
          const delta = expected > 0 ? overrideLevel - expected : null;
          const result =
            expected === 0 || delta === null
              ? "not_assessed"
              : delta === 0
              ? "match"
              : delta > 0
              ? "exceed"
              : "gap";

          return {
            ...sc,
            candidate_level: overrideLevel,
            is_override: true,
            delta,
            result,
          };
        });

        if (modified) {
          queryClient.setQueryData(qKey, {
            ...cachedData,
            report: {
              ...report,
              skill_comparisons: updatedComparisons,
            },
          });
        }
      }

      return { previousData, previousFitGapMap };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.portfolio.bySession(sId), context.previousData);
      }
      if (context?.previousFitGapMap) {
        context.previousFitGapMap.forEach(([qKey, prevData]) => {
          queryClient.setQueryData(qKey, prevData);
        });
      }
    },
    onSuccess: (data) => {
      const confirmedOverride = data;
      if (!confirmedOverride) return;

      // Update the portfolio cache with the confirmed server override record
      queryClient.setQueryData<PortfolioApiResponse>(
        queryKeys.portfolio.bySession(sId),
        (old) => {
          if (!old?.portfolio) return old;
          const skills = (old.portfolio.skills || []).map((s) =>
            s.id === confirmedOverride.portfolio_skill_id
              ? { ...s, assessor_override: confirmedOverride }
              : s
          );
          const overrides = [
            ...(old.portfolio.overrides || []).filter(
              (o) => o.portfolio_skill_id !== confirmedOverride.portfolio_skill_id
            ),
            confirmedOverride,
          ];
          return {
            ...old,
            portfolio: {
              ...old.portfolio,
              skills,
              overrides,
            },
          };
        }
      );
    },
  });
}

export function useRegeneratePortfolioMutation(sessionId: number | string | undefined) {
  const queryClient = useQueryClient();
  const sId = Number(sessionId);

  return useMutation({
    mutationFn: async () => {
      const res = await sessionsApi.regeneratePortfolio(sId);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.bySession(sId) });
    },
  });
}
