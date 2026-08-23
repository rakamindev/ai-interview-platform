import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";
import { m } from "@/(paraglide)/messages.js";

export default function NotFoundPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Compass className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-primary">404</p>
          <h1 className="text-xl font-semibold tracking-tight">{m.not_found.title()}</h1>
          <p className="text-sm text-muted-foreground">
            {m.not_found.description()}
          </p>
        </div>
        <Button asChild>
          <Link to="/">{m.not_found.go_home()}</Link>
        </Button>
      </div>
    </main>
  );
}
