import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, CircleX, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";

import { PageContainer } from "@/components/layout/page-container";
import { VacancyCard, VacancyCardSkeleton } from "@/features/vacancy/components/vacancy-card";
import { usePagination } from "@/hooks/use-pagination";
import { vacancySearchSchema } from "@/features/vacancy/schemas/vacancy";
import { vacancyQueries } from "@/features/vacancy/queries/vacancy";

export const Route = createFileRoute("/_protected/vacancies/")({
  validateSearch: vacancySearchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = Route.useNavigate();
  const { page, per_page } = Route.useSearch();

  const { data, isLoading, error } = useQuery(vacancyQueries.list({ page, per_page }));

  const { hasPreviousPage, hasNextPage, next, previous } = usePagination({
    page: page,
    total: data?.meta.total_pages ?? 1,
    onChange: (_page) => {
      navigate({
        search: (prev) => ({
          ...prev,
          page: _page,
        }),
      });
    },
  });

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Vacancies</h1>
          <p className="text-sm text-muted-foreground">
            Role definitions with required skills and expected levels for hiring decisions.
          </p>
        </div>

        <Button size="lg" nativeButton={false} render={<Link to="/vacancies/new" />}>
          <Plus data-icon="inline-start" />
          New Vacancy
        </Button>
      </div>

      {!error ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 3 }, (_, i) => <VacancyCardSkeleton key={i} />)
          ) : (data?.vacancies.length ?? 0) === 0 ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Briefcase />
                  </EmptyMedia>
                  <EmptyTitle>No vacancies yet.</EmptyTitle>
                  <EmptyDescription>
                    Create a vacancy to define required skills and levels for hiring decisions.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            data?.vacancies.map((item) => <VacancyCard key={item.id} data={item} />)
          )}
        </div>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
              <CircleX />
            </EmptyMedia>
            <EmptyTitle>Failed to load vacancies. Please refresh the page.</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}

      {data && data.meta.total_pages > 1 ? (
        <Pagination className="justify-end">
          <PaginationContent className="gap-2">
            <PaginationItem>
              <Button
                size="sm"
                variant="outline"
                aria-label="Previous"
                disabled={!hasPreviousPage || isLoading}
                onClick={() => previous()}
              >
                Previous
              </Button>
            </PaginationItem>
            <PaginationItem>
              <Button
                size="sm"
                variant="outline"
                aria-label="Next"
                disabled={!hasNextPage || isLoading}
                onClick={() => next()}
              >
                Next
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </PageContainer>
  );
}
