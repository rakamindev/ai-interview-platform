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
import { AddVacancyForm } from "@/features/vacancy/components/add-vacancy-form";

export const Route = createFileRoute("/_protected/vacancies/new")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <PageContainer>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/vacancies" />}>Vacancies</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>New Vacancy</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <AddVacancyForm />
    </PageContainer>
  );
}
