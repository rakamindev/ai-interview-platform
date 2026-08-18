import { createFileRoute } from "@tanstack/react-router";

import { CandidateLayout } from "@/components/layout/candidate-layout";

export const Route = createFileRoute("/_public")({
  component: RouteComponent,
});

function RouteComponent() {
  return <CandidateLayout />;
}
