import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SearchX } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-sm text-center space-y-4 px-4">
        <SearchX className="h-10 w-10 mx-auto text-muted-foreground" />
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">404</h1>
          <p className="text-sm text-muted-foreground">
            This page doesn't exist or may have moved.
          </p>
        </div>
        <Button asChild className="mt-2">
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
