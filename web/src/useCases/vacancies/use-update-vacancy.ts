import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { vacanciesApi, type VacancyPayload } from "@/services/vacancies";
import { vacancyQueryKeys } from "./queryKeys";

export const useUpdateVacancy = (
  opt?: UseMutationOptions<
    Awaited<ReturnType<typeof vacanciesApi.update>>["data"],
    Error,
    { id: number; data: VacancyPayload }
  >,
) => {
  const qc = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpt } = opt ?? {};
  return useMutation({
    mutationFn: ({ id, data }) => vacanciesApi.update(id, data).then((r) => r.data),
    onSuccess: (data, vars, ctx, mutation) => {
      qc.invalidateQueries({ queryKey: vacancyQueryKeys.all });
      qc.invalidateQueries({ queryKey: vacancyQueryKeys.detail(vars.id) });
      userOnSuccess?.(data, vars, ctx, mutation);
    },
    ...restOpt,
  });
};
