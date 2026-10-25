import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { vacanciesApi } from "@/services/vacancies";
import { vacancyQueryKeys } from "./queryKeys";

export const useDeleteVacancy = (
  opt?: UseMutationOptions<void, Error, number>,
) => {
  const qc = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpt } = opt ?? {};
  return useMutation({
    mutationFn: (id) => vacanciesApi.delete(id).then(() => undefined),
    onSuccess: (data, id, ctx, mutation) => {
      qc.invalidateQueries({ queryKey: vacancyQueryKeys.all });
      userOnSuccess?.(data, id, ctx, mutation);
    },
    ...restOpt,
  });
};
