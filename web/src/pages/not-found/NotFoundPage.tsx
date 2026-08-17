import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileQuestion, ArrowLeft, Home } from "lucide-react";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 mx-auto ring-8 ring-amber-500/5">
          <FileQuestion className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold tracking-wider text-amber-600 uppercase">
            404 — Page Not Found
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            We couldn't find this page
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The link you followed may be broken, or the page may have been moved.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
          <Button size="sm" asChild>
            <Link to="/assessments" className="gap-2">
              <Home className="h-4 w-4" />
              Assessments Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
