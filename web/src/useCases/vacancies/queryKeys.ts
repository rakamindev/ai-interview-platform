export const vacancyQueryKeys = {
  all: ["vacancies"] as const,
  list: (page: number) => [...vacancyQueryKeys.all, "list", { page }] as const,
  detail: (id: number) => [...vacancyQueryKeys.all, "detail", id] as const,
};
