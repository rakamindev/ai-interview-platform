import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Briefcase, Calendar, ChevronRight, CircleX, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@/components/ui/frame";
import { Skeleton } from "@/components/ui/skeleton";

import { PageContainer } from "@/components/layout/page-container";
import { DeleteVacancyDialog } from "@/features/vacancy/components/delete-vacancy-dialog";
import { vacancyQueries } from "@/features/vacancy/queries/vacancy";
import { LEVEL_LABELS } from "@/utils/constants";

export const Route = createFileRoute("/_protected/vacancies/$vacancyId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { vacancyId } = Route.useParams();
  const id = Number(vacancyId);

  const { data, isLoading, error } = useQuery(vacancyQueries.detail(id));
  const [deleteOpen, setDeleteOpen] = useState(false);

  const vacancy = data?.vacancy;

  if (error) {
    return (
      <PageContainer>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link to="/vacancies" />}>Vacancies</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>Vacancy Detail</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
              {error.response.status === 404 ? <Briefcase /> : <CircleX />}
            </EmptyMedia>
            <EmptyTitle>
              {error.response.status === 404 ? "Vacancy not found" : "Failed to load vacancy. Please refresh the page."}
            </EmptyTitle>
          </EmptyHeader>
        </Empty>
      </PageContainer>
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
            <BreadcrumbPage>{vacancy?.role_title ?? "Vacancy Detail"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          {isLoading || typeof vacancy === "undefined" ? (
            <Skeleton className="h-8 w-52" />
          ) : (
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{vacancy.role_title}</h1>
          )}

          <div className="flex flex-wrap items-center gap-4">
            {isLoading || typeof vacancy === "undefined" ? (
              <Skeleton className="h-5 w-14" />
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Briefcase className="size-4 shrink-0" />
                {vacancy.skills.length} skills
              </p>
            )}

            {isLoading || typeof vacancy === "undefined" ? (
              <Skeleton className="h-5 w-14" />
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="size-4 shrink-0" />
                Created {format(vacancy.created_at, "dd/MM/yyyy HH:mm")}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Open actions" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem render={<Link to="/vacancies/$vacancyId/edit" params={{ vacancyId }} />}>
                <Pencil />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {vacancy && (
        <div className="flex w-full flex-col gap-4">
          <Frame stacked dense spacing="sm" className="w-full">
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex w-full">
                <FrameHeader className="flex grow flex-row items-center justify-between gap-2">
                  <FrameTitle>Required Skills ({vacancy.skills.length})</FrameTitle>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 text-muted-foreground transition-transform in-data-open:rotate-90"
                  />
                </FrameHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <FramePanel className="typeset typeset-docs">
                  <ul>
                    {vacancy.skills.map((item) => (
                      <li key={item.id || item.skill_id || item.skill_label} className="text-sm">
                        <span>{item.skill_label}</span> &nbsp;
                        <span className="text-xs text-muted-foreground">
                          (expected {LEVEL_LABELS[item.expected_level]})
                        </span>
                      </li>
                    ))}
                  </ul>
                </FramePanel>
              </CollapsibleContent>
            </Collapsible>
          </Frame>

          {vacancy.culture_dimensions ? (
            <Frame stacked dense spacing="sm" className="w-full">
              <FrameHeader>
                <FrameTitle>Culture Dimensions</FrameTitle>
              </FrameHeader>
              <FramePanel className="typeset typeset-docs">
                <p className="text-sm whitespace-pre-wrap">{vacancy.culture_dimensions}</p>
              </FramePanel>
            </Frame>
          ) : null}

          {vacancy.competency_expectations ? (
            <Frame stacked dense spacing="sm" className="w-full">
              <FrameHeader>
                <FrameTitle>Competency Expectations</FrameTitle>
              </FrameHeader>
              <FramePanel className="typeset typeset-docs">
                <p className="text-sm whitespace-pre-wrap">{vacancy.competency_expectations}</p>
              </FramePanel>
            </Frame>
          ) : null}
        </div>
      )}

      <DeleteVacancyDialog
        id={id}
        roleTitle={vacancy?.role_title ?? ""}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </PageContainer>
  );
}
