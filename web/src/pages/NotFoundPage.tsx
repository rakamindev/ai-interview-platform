import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import BrandMark from "@/components/layout/BrandMark";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-4">
      <div className="bg-brand-gradient flex min-h-[calc(100vh-1.5rem)] flex-col items-center justify-center gap-6 rounded-[2rem] p-8 text-center sm:min-h-[calc(100vh-2rem)]">
        <BrandMark />
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
          <p className="text-sm text-rakamin-charcoal/80">
            This page doesn't exist. Check the link you followed.
          </p>
        </div>
        <Button asChild>
          <Link to="/">Go to the home page</Link>
        </Button>
      </div>
    </div>
  );
}
