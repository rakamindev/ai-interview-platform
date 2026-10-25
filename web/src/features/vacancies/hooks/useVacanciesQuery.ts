import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vacanciesApi, type VacancyPayload } from "../services/vacancies";
import { queryKeys } from "@/lib/queryKeys";
import type { Vacancy } from "@/types";

export function useVacanciesQuery() {
  return useQuery({
    queryKey: queryKeys.vacancies.list(),
    queryFn: async (): Promise<Vacancy[]> => {
      const res = await vacanciesApi.list();
      return res.data.vacancies || [];
    },
  });
}

export function useVacancyDetailQuery(id: number | string | undefined) {
  const vId = Number(id);

  return useQuery({
    queryKey: queryKeys.vacancies.detail(vId),
    queryFn: async (): Promise<Vacancy> => {
      const res = await vacanciesApi.get(vId);
      return res.data.vacancy;
    },
    enabled: !isNaN(vId) && vId > 0,
  });
}

export function useCreateVacancyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: VacancyPayload) => {
      const res = await vacanciesApi.create(payload);
      return res.data;
    },
    // Optimistic Update: append immediately to cached vacancies list
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.vacancies.list() });
      const previousList = queryClient.getQueryData<Vacancy[]>(queryKeys.vacancies.list()) || [];

      const tempId = -Date.now();
      const optimisticVacancy: Vacancy = {
        id: tempId,
        role_title: payload.role_title,
        culture_dimensions: payload.culture_dimensions || "",
        competency_expectations: payload.competency_expectations || "",
        created_at: new Date().toISOString(),
        skills: (payload.vacancy_skills_attributes || []).map((s, idx) => ({
          id: -(Date.now() + idx),
          skill_id: s.skill_id ?? idx,
          skill_label: s.skill_label || "",
          expected_level: s.expected_level || 1,
        })),
      };

      queryClient.setQueryData<Vacancy[]>(queryKeys.vacancies.list(), [optimisticVacancy, ...previousList]);
      return { previousList, tempId };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(queryKeys.vacancies.list(), context.previousList);
      }
    },
    onSuccess: (data, _variables, context) => {
      const created = data.vacancy;
      if (!created) return;

      // Update vacancies list cache with the real saved vacancy
      queryClient.setQueryData<Vacancy[]>(queryKeys.vacancies.list(), (old = []) => {
        const withoutTemp = old.filter((v) => v.id !== context?.tempId && v.id !== created.id);
        return [created, ...withoutTemp];
      });

      // Seed detail cache directly so detail page loads instantly without server fetch
      queryClient.setQueryData(queryKeys.vacancies.detail(created.id), created);
    },
  });
}

export function useUpdateVacancyMutation(id: number | string | undefined) {
  const queryClient = useQueryClient();
  const vId = Number(id);

  return useMutation({
    mutationFn: async (payload: VacancyPayload) => {
      const res = await vacanciesApi.update(vId, payload);
      return res.data;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.vacancies.list() });
      await queryClient.cancelQueries({ queryKey: queryKeys.vacancies.detail(vId) });

      const previousList = queryClient.getQueryData<Vacancy[]>(queryKeys.vacancies.list());
      const previousDetail = queryClient.getQueryData<Vacancy>(queryKeys.vacancies.detail(vId));

      // Optimistically update detail
      if (previousDetail) {
        queryClient.setQueryData<Vacancy>(queryKeys.vacancies.detail(vId), {
          ...previousDetail,
          role_title: payload.role_title,
          culture_dimensions: payload.culture_dimensions,
          competency_expectations: payload.competency_expectations,
        });
      }

      // Optimistically update item in list
      if (previousList) {
        queryClient.setQueryData<Vacancy[]>(
          queryKeys.vacancies.list(),
          previousList.map((v) =>
            v.id === vId
              ? {
                  ...v,
                  role_title: payload.role_title,
                  culture_dimensions: payload.culture_dimensions,
                  competency_expectations: payload.competency_expectations,
                }
              : v
          )
        );
      }

      return { previousList, previousDetail };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(queryKeys.vacancies.list(), context.previousList);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(queryKeys.vacancies.detail(vId), context.previousDetail);
      }
    },
    onSuccess: (data) => {
      const updated = data.vacancy;
      if (!updated) return;

      queryClient.setQueryData(queryKeys.vacancies.detail(vId), updated);
      queryClient.setQueryData<Vacancy[]>(queryKeys.vacancies.list(), (old = []) =>
        old.map((v) => (v.id === vId ? updated : v))
      );
    },
  });
}

export function useDeleteVacancyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await vacanciesApi.delete(id);
      return res.data;
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.vacancies.list() });
      const previousList = queryClient.getQueryData<Vacancy[]>(queryKeys.vacancies.list());

      if (previousList) {
        queryClient.setQueryData<Vacancy[]>(
          queryKeys.vacancies.list(),
          previousList.filter((v) => v.id !== deletedId)
        );
      }
      return { previousList };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(queryKeys.vacancies.list(), context.previousList);
      }
    },
    onSuccess: (_data, deletedId) => {
      queryClient.removeQueries({ queryKey: queryKeys.vacancies.detail(deletedId) });
    },
  });
}
