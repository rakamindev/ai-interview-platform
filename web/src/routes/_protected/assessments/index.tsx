import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CircleX, ClipboardList, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";

import { PageContainer } from "@/components/layout/page-container";
import { AccountCardSkeleton, AssessmentCard } from "@/features/assessment/components/assessment-card";
import { usePagination } from "@/hooks/use-pagination";
import { assessmentSearchSchema } from "@/features/assessment/schemas/assessment";
import { assessmentQueries } from "@/features/assessment/queries/assessment";

export const Route = createFileRoute("/_protected/assessments/")({
  validateSearch: assessmentSearchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = Route.useNavigate();
  const { page, per_page } = Route.useSearch();

  const { data, isLoading, error } = useQuery(assessmentQueries.list({ page, per_page }));

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
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Assessments</h1>
          <p className="text-sm text-muted-foreground">
            Configured interview definitions with skills to examine and expected skill levels.
          </p>
        </div>

        <Button size="lg" nativeButton={false} render={<Link to="/assessments/new" />}>
          <Plus data-icon="inline-start" />
          New Assessment
        </Button>
      </div>

      {!error ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 3 }, (_, i) => <AccountCardSkeleton key={i} />)
          ) : (data?.assessments.length ?? 0) === 0 ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ClipboardList />
                  </EmptyMedia>
                  <EmptyTitle>No assessments yet.</EmptyTitle>
                  <EmptyDescription>
                    Create an assessment to configure interview skills and expected levels.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            data?.assessments.map((item) => <AssessmentCard key={item.id} data={item} />)
          )}
        </div>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
              <CircleX />
            </EmptyMedia>
            <EmptyTitle>Failed to load assessments. Please refresh the page.</EmptyTitle>
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
