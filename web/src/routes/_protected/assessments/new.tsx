import { createFileRoute, Link } from "@tanstack/react-router";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { PageContainer } from "@/components/layout/page-container";
import { AddAssessmentForm } from "@/features/assessment/components/add-assessment-form";

export const Route = createFileRoute("/_protected/assessments/new")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <PageContainer>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/assessments" />}>Assessments</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>New Assessment</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <AddAssessmentForm />
    </PageContainer>
  );
}
