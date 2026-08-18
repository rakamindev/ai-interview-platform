import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

import { PageContainer } from "@/components/layout/page-container";
import { EditVacancyForm } from "@/features/vacancy/components/edit-vacancy-form";
import { vacancyQueries } from "@/features/vacancy/queries/vacancy";

export const Route = createFileRoute("/_protected/vacancies/$vacancyId/edit")({
  component: RouteComponent,
});

function RouteComponent() {
  const { vacancyId } = Route.useParams();
  const id = Number(vacancyId);

  const { data, isLoading, isError, error } = useQuery(vacancyQueries.detail(id));

  if (isLoading) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Spinner />
          </EmptyMedia>
          <EmptyTitle>Processing your request</EmptyTitle>
          <EmptyDescription>Please wait while we process your request. Do not refresh the page.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (isError || !data) {
    const notFound = error && error.response.status === 404;
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon" className={notFound ? "bg-destructive/10 text-destructive" : undefined}>
            <ClipboardList />
          </EmptyMedia>
          <EmptyTitle>{notFound ? "Vacancy not found" : "Failed to load vacancy. Please refresh the page."}</EmptyTitle>
          <EmptyContent className="flex-row justify-center gap-2">
            <Button variant="outline" nativeButton={false} render={<Link to="/vacancies" />}>
              Back to Vacancies
            </Button>
          </EmptyContent>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <PageContainer>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/vacancies" />}>Vacancies</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/vacancies/$vacancyId" params={{ vacancyId }} />}>
              {data.vacancy.role_title}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>Edit Vacancy</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <EditVacancyForm vacancy={data.vacancy} />
    </PageContainer>
  );
}
