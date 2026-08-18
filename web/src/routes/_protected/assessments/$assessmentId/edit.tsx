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
import { EditAssessmentForm } from "@/features/assessment/components/edit-assessment-form";
import { assessmentQueries } from "@/features/assessment/queries/assessment";

export const Route = createFileRoute("/_protected/assessments/$assessmentId/edit")({
  component: RouteComponent,
});

function RouteComponent() {
  const { assessmentId } = Route.useParams();
  const id = Number(assessmentId);

  const { data, isLoading, isError, error } = useQuery(assessmentQueries.detail(id));

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
          <EmptyTitle>
            {notFound ? "Assessment not found" : "Failed to load assessment. Please refresh the page."}
          </EmptyTitle>
          <EmptyContent className="flex-row justify-center gap-2">
            <Button variant="outline" nativeButton={false} render={<Link to="/assessments" />}>
              Back to Assessments
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
            <BreadcrumbLink render={<Link to="/assessments" />}>Assessments</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/assessments/$assessmentId" params={{ assessmentId }} />}>
              {data.assessment.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>Edit Assessment</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <EditAssessmentForm assessment={data.assessment} />
    </PageContainer>
  );
}
