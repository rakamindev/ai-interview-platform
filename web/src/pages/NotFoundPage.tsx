import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-4 max-w-sm">
        <FileQuestion className="h-12 w-12 mx-auto text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold">Page not found</h1>
          <p className="text-sm text-muted-foreground mt-1">
            The page you're looking for doesn't exist or may have moved.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/assessments">Back to assessments</Link>
        </Button>
      </div>
    </div>
  );
}
