import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { vacanciesApi, type VacancyPayload } from "@/services/vacancies";
import { vacancyQueryKeys } from "./queryKeys";

export const useCreateVacancy = (
  opt?: UseMutationOptions<Awaited<ReturnType<typeof vacanciesApi.create>>["data"], Error, VacancyPayload>,
) => {
  const qc = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpt } = opt ?? {};
  return useMutation({
    mutationFn: (data) => vacanciesApi.create(data).then((r) => r.data),
    onSuccess: (data, vars, ctx, mutation) => {
      qc.invalidateQueries({ queryKey: vacancyQueryKeys.all });
      userOnSuccess?.(data, vars, ctx, mutation);
    },
    ...restOpt,
  });
};
