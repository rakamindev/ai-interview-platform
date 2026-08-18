import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Brain,
  ChevronRight,
  CircleX,
  ClipboardList,
  Clock,
  Languages,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
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
import { CandidateCard } from "@/features/assessment/components/candidate-card";
import { DeleteAssessmentDialog } from "@/features/assessment/components/delete-assessment-dialog";
import { InviteCandidateDialog } from "@/features/assessment/components/invite-candidate-dialog";
import { assessmentQueries } from "@/features/assessment/queries/assessment";
import { LEVEL_LABELS } from "@/utils/constants";

export const Route = createFileRoute("/_protected/assessments/$assessmentId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { assessmentId } = Route.useParams();
  const id = Number(assessmentId);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data, isLoading, error } = useQuery(assessmentQueries.detail(id));

  const assessment = data?.assessment;

  if (error) {
    return (
      <PageContainer>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link to="/assessments" />}>Assessments</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>Assessment Detail</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
              {error.response.status === 404 ? <ClipboardList /> : <CircleX />}
            </EmptyMedia>
            <EmptyTitle>
              {error.response.status === 404
                ? "Assessment not found"
                : "Failed to load assessment. Please refresh the page."}
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
            <BreadcrumbLink render={<Link to="/assessments" />}>Assessments</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>{assessment?.name ?? "Assessment Detail"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          {isLoading || typeof assessment === "undefined" ? (
            <Skeleton className="h-8 w-52" />
          ) : (
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{assessment.name}</h1>
          )}

          <div className="flex flex-wrap items-center gap-4">
            {isLoading || typeof assessment === "undefined" ? (
              <Skeleton className="h-5 w-14" />
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="size-4 shrink-0" />
                {assessment.time_limit_min} min
              </p>
            )}

            {isLoading || typeof assessment === "undefined" ? (
              <Skeleton className="h-5 w-14" />
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Brain className="size-4 shrink-0" />
                {assessment.skills.length} skills
              </p>
            )}

            {isLoading || typeof assessment === "undefined" ? (
              <Skeleton className="h-5 w-14" />
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Languages className="size-4 shrink-0" />
                {assessment.language === "en" ? "English" : "Indonesia"}
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
              <DropdownMenuItem render={<Link to="/assessments/$assessmentId/edit" params={{ assessmentId }} />}>
                <Pencil />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button type="button" aria-label="Invite candidate" onClick={() => setInviteOpen(true)}>
            <Plus data-icon="inline-start" />
            Invite Candidate
          </Button>
        </div>
      </div>

      {assessment && assessment.skills.length > 0 ? (
        <Frame stacked dense spacing="sm" className="w-full">
          <Collapsible>
            <CollapsibleTrigger className="flex w-full">
              <FrameHeader className="flex grow flex-row items-center justify-between gap-2">
                <FrameTitle>Skills Assessed ({assessment.skills.length})</FrameTitle>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 text-muted-foreground transition-transform in-data-open:rotate-90"
                />
              </FrameHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <FramePanel className="typeset typeset-docs">
                <ul>
                  {assessment.skills.map((item) => (
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
      ) : null}

      <CandidateCard id={id} />

      <DeleteAssessmentDialog id={id} name={assessment?.name ?? ""} open={deleteOpen} onOpenChange={setDeleteOpen} />

      <InviteCandidateDialog assessmentId={id} open={inviteOpen} onOpenChange={setInviteOpen} />
    </PageContainer>
  );
}
