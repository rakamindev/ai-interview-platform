export const queryKeys = {
  assessments: {
    all: ["assessments"] as const,
    list: (page?: number) => ["assessments", "list", page ?? 1] as const,
    detail: (id: number | string) => ["assessments", "detail", Number(id)] as const,
    sessions: (assessmentId: number | string) => ["assessments", Number(assessmentId), "sessions"] as const,
  },
  vacancies: {
    all: ["vacancies"] as const,
    list: () => ["vacancies", "list"] as const,
    detail: (id: number | string) => ["vacancies", "detail", Number(id)] as const,
  },
  sessions: {
    all: ["sessions"] as const,
    detail: (id: number | string) => ["sessions", "detail", Number(id)] as const,
    transcript: (id: number | string) => ["sessions", "transcript", Number(id)] as const,
  },
  portfolio: {
    all: ["portfolio"] as const,
    bySession: (sessionId: number | string) => ["portfolio", "session", Number(sessionId)] as const,
  },
  fitgap: {
    all: ["fitgap"] as const,
    byPortfolio: (portfolioId: number | string) => ["fitgap", Number(portfolioId)] as const,
    detail: (portfolioId: number | string, vacancyId: number | string) =>
      ["fitgap", Number(portfolioId), Number(vacancyId)] as const,
  },
  skillTaxonomies: {
    all: ["skillTaxonomies"] as const,
  },
};
