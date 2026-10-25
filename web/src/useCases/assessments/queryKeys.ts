export const assessmentQueryKeys = {
  all: ["assessments"] as const,
  list: (page: number) => [...assessmentQueryKeys.all, "list", { page }] as const,
  detail: (id: number) => [...assessmentQueryKeys.all, "detail", id] as const,
  sessions: (id: number) => [...assessmentQueryKeys.all, id, "sessions"] as const,
};
