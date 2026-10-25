import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assessmentsApi, type AssessmentPayload } from "../services/assessments";
import { queryKeys } from "@/lib/queryKeys";
import type { Assessment, Session } from "@/types";

export function useAssessmentsQuery(page: number = 1) {
  return useQuery({
    queryKey: queryKeys.assessments.list(page),
    queryFn: async (): Promise<Assessment[]> => {
      const res = await assessmentsApi.list(page);
      return res.data.assessments || [];
    },
  });
}

export function useAssessmentDetailQuery(id: number | string | undefined) {
  const aId = Number(id);

  return useQuery({
    queryKey: queryKeys.assessments.detail(aId),
    queryFn: async (): Promise<Assessment> => {
      const res = await assessmentsApi.get(aId);
      return res.data.assessment;
    },
    enabled: !isNaN(aId) && aId > 0,
  });
}

export function useAssessmentSessionsQuery(assessmentId: number | string | undefined) {
  const aId = Number(assessmentId);

  return useQuery({
    queryKey: queryKeys.assessments.sessions(aId),
    queryFn: async (): Promise<Session[]> => {
      const res = await assessmentsApi.getSessions(aId);
      return res.data.sessions || [];
    },
    enabled: !isNaN(aId) && aId > 0,
    // Smart conditional polling: poll every 5s ONLY if any session is unfinished
    refetchInterval: (query) => {
      const sessions = query.state.data;
      if (!sessions || sessions.length === 0) return false;
      const hasUnfinished = sessions.some((s) => s.status !== "ended");
      return hasUnfinished ? 5000 : false;
    },
  });
}

export function useCreateAssessmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AssessmentPayload) => {
      const res = await assessmentsApi.create(payload);
      return res.data;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.assessments.list(1) });
      const previousList = queryClient.getQueryData<Assessment[]>(queryKeys.assessments.list(1)) || [];

      const tempId = -Date.now();
      const optimisticAssessment: Assessment = {
        id: tempId,
        name: payload.name,
        time_limit_min: payload.time_limit_min,
        language: payload.language || "en",
        created_at: new Date().toISOString(),
        skills: (payload.assessment_skills_attributes || []).map((s, idx) => ({
          id: -(Date.now() + idx),
          skill_id: s.skill_id,
          skill_label: s.skill_label || "",
          is_custom: s.is_custom ?? false,
          expected_level: s.expected_level || 3,
          display_order: s.display_order ?? idx,
        })),
      };

      queryClient.setQueryData<Assessment[]>(queryKeys.assessments.list(1), [optimisticAssessment, ...previousList]);
      return { previousList, tempId };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(queryKeys.assessments.list(1), context.previousList);
      }
    },
    onSuccess: (data, _variables, context) => {
      const created = data.assessment;
      if (!created) return;

      queryClient.setQueryData<Assessment[]>(queryKeys.assessments.list(1), (old = []) => {
        const withoutTemp = old.filter((a) => a.id !== context?.tempId && a.id !== created.id);
        return [created, ...withoutTemp];
      });

      queryClient.setQueryData(queryKeys.assessments.detail(created.id), created);
    },
  });
}

export function useUpdateAssessmentMutation(id: number | string | undefined) {
  const queryClient = useQueryClient();
  const aId = Number(id);

  return useMutation({
    mutationFn: async (payload: AssessmentPayload) => {
      const res = await assessmentsApi.update(aId, payload);
      return res.data;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.assessments.list(1) });
      await queryClient.cancelQueries({ queryKey: queryKeys.assessments.detail(aId) });

      const previousList = queryClient.getQueryData<Assessment[]>(queryKeys.assessments.list(1));
      const previousDetail = queryClient.getQueryData<Assessment>(queryKeys.assessments.detail(aId));

      if (previousDetail) {
        queryClient.setQueryData<Assessment>(queryKeys.assessments.detail(aId), {
          ...previousDetail,
          name: payload.name,
          time_limit_min: payload.time_limit_min,
          language: payload.language || previousDetail.language,
        });
      }

      if (previousList) {
        queryClient.setQueryData<Assessment[]>(
          queryKeys.assessments.list(1),
          previousList.map((a) =>
            a.id === aId
              ? {
                  ...a,
                  name: payload.name,
                  time_limit_min: payload.time_limit_min,
                  language: payload.language || a.language,
                }
              : a
          )
        );
      }

      return { previousList, previousDetail };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(queryKeys.assessments.list(1), context.previousList);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(queryKeys.assessments.detail(aId), context.previousDetail);
      }
    },
    onSuccess: (data) => {
      const updated = data.assessment;
      if (!updated) return;

      queryClient.setQueryData(queryKeys.assessments.detail(aId), updated);
      queryClient.setQueryData<Assessment[]>(queryKeys.assessments.list(1), (old = []) =>
        old.map((a) => (a.id === aId ? updated : a))
      );
    },
  });
}

export function useDeleteAssessmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await assessmentsApi.delete(id);
      return res.data;
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.assessments.list(1) });
      const previousList = queryClient.getQueryData<Assessment[]>(queryKeys.assessments.list(1));

      if (previousList) {
        queryClient.setQueryData<Assessment[]>(
          queryKeys.assessments.list(1),
          previousList.filter((a) => a.id !== deletedId)
        );
      }
      return { previousList };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(queryKeys.assessments.list(1), context.previousList);
      }
    },
    onSuccess: (_data, deletedId) => {
      queryClient.removeQueries({ queryKey: queryKeys.assessments.detail(deletedId) });
    },
  });
}

export function useCreateSessionMutation(assessmentId: number | string | undefined) {
  const queryClient = useQueryClient();
  const aId = Number(assessmentId);

  return useMutation({
    mutationFn: async (candidateName?: string) => {
      const res = await assessmentsApi.createSession(aId, candidateName);
      return res.data;
    },
    onMutate: async (candidateName) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.assessments.sessions(aId) });
      const previousSessions = queryClient.getQueryData<Session[]>(queryKeys.assessments.sessions(aId)) || [];

      const tempId = -Date.now();
      const optimisticSession: Session = {
        id: tempId,
        assessment_id: aId,
        candidate_name: candidateName || "New Candidate",
        status: "pending",
        created_at: new Date().toISOString(),
        invite_token: "",
        invite_url: "",
      };

      queryClient.setQueryData<Session[]>(queryKeys.assessments.sessions(aId), [
        optimisticSession,
        ...previousSessions,
      ]);

      return { previousSessions, tempId };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousSessions) {
        queryClient.setQueryData(queryKeys.assessments.sessions(aId), context.previousSessions);
      }
    },
    onSuccess: (data, _variables, context) => {
      const created = data.session;
      if (!created) return;

      queryClient.setQueryData<Session[]>(queryKeys.assessments.sessions(aId), (old = []) => {
        const withoutTemp = old.filter((s) => s.id !== context?.tempId && s.id !== created.id);
        return [created, ...withoutTemp];
      });

      // Seed session detail cache so candidate/monitor view loads instantly
      queryClient.setQueryData(queryKeys.sessions.detail(created.id), created);
    },
  });
}
