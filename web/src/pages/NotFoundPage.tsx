import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LayoutDashboard } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function NotFoundPage() {
  usePageTitle("Page not found");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-4 space-y-4">
      <p className="text-7xl font-bold text-primary">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground max-w-xs">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button asChild>
        <Link to="/assessments">
          <LayoutDashboard className="h-4 w-4 mr-2" />
          Back to Assessments
        </Link>
      </Button>
    </div>
  );
}
