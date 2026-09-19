import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function NotFoundPage() {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = "Page not found";
    headingRef.current?.focus();
  }, []);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-12 text-center">
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand-deep">
        <FileQuestion className="h-6 w-6" />
      </span>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-xl font-semibold tracking-tight text-foreground"
      >
        The page you're looking for doesn't exist.
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        It may have been removed or the address is incorrect.
      </p>
      <Button className="mt-6" asChild>
        <Link to="/assessments">Back to assessments</Link>
      </Button>
    </div>
  );
}