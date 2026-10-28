import { Link } from "react-router-dom";
import { MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell } from "@/components/ui/page-shell";

// Unknown assessor URLs used to render a blank page.
export default function NotFoundPage() {
  return (
    <PageShell width="narrow" className="pt-8">
      <EmptyState icon={MapPinOff} headingLevel={1} title="Page not found"
                  description="The address may be mistyped, or the page no longer exists."
                  action={<Button asChild><Link to="/assessments">Go to assessments</Link></Button>}
                  className="bg-card" />
    </PageShell>
  );
}
