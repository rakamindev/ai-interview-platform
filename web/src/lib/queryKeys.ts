export const assessmentKeys = {
  all: ["assessments"] as const,
  lists: () => [...assessmentKeys.all, "list"] as const,
  list: (page: number) => [...assessmentKeys.lists(), { page }] as const,
  details: () => [...assessmentKeys.all, "detail"] as const,
  detail: (id: number) => [...assessmentKeys.details(), id] as const,
  sessions: (id: number) => [...assessmentKeys.detail(id), "sessions"] as const,
};

export const vacancyKeys = {
  all: ["vacancies"] as const,
  lists: () => [...vacancyKeys.all, "list"] as const,
  list: (page: number, perPage?: number) =>
    [...vacancyKeys.lists(), { page, perPage }] as const,
  details: () => [...vacancyKeys.all, "detail"] as const,
  detail: (id: number) => [...vacancyKeys.details(), id] as const,
};

export const skillTaxonomyKeys = {
  all: ["skill-taxonomies"] as const,
  list: () => [...skillTaxonomyKeys.all, "list"] as const,
};

export const adminInvitationKeys = {
  all: ["admin-invitations"] as const,
  list: () => [...adminInvitationKeys.all, "list"] as const,
};

export const sessionKeys = {
  all: ["sessions"] as const,
  detail: (id: number) => [...sessionKeys.all, "detail", id] as const,
  transcript: (id: number, fromTurn?: number) =>
    [...sessionKeys.all, "transcript", id, { fromTurn }] as const,
  portfolio: (id: number) => [...sessionKeys.all, "portfolio", id] as const,
};

export const portfolioKeys = {
  all: ["portfolios"] as const,
  fitGap: (portfolioId: number, vacancyId: number) =>
    [...portfolioKeys.all, portfolioId, "fit-gap", vacancyId] as const,
};
