import { Briefcase, ClipboardList, Plus } from "lucide-react";
import { Button } from "../ui/button";

export function EmptyStateVacancy() {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-12 text-center border border-dashed rounded-xl">
      <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-muted">
        <Briefcase className="w-6 h-6 text-muted-foreground" />
      </div>

      <h3 className="mt-4 text-base font-semibold">
        There are no job openings yet
      </h3>

      <p className="max-w-sm mt-1 text-sm text-muted-foreground">
        The job postings you create will be displayed here.
      </p>
    </div>
  );
}

export function EmptyStateAsesment({
  navigate,
}: {
  navigate: (url: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-12 text-center border border-dashed rounded-xl bg-muted/20 sm:py-16">
      <div className="flex items-center justify-center size-16 rounded-2xl bg-primary/10 text-primary">
        <ClipboardList className="size-8" />
      </div>

      <h3 className="mt-5 text-lg font-semibold tracking-tight">
        No assessments yet
      </h3>

      <p className="max-w-sm mt-2 text-sm leading-relaxed text-muted-foreground">
        Create your first assessment to start inviting candidates and tracking
        their interview sessions.
      </p>

      <Button
        onClick={() => navigate("/assessments/new")}
        className="w-full mt-6 sm:w-auto"
      >
        <Plus className="mr-1.5 h-4 w-4" />
        Create your first assessment
      </Button>
    </div>
  );
}
