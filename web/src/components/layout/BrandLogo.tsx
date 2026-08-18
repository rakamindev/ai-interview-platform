import { Link } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  /** "link" wraps in a Link to /assessments (default for auth pages) */
  as?: "link" | "div";
  size?: "sm" | "md";
  /** Force light text (for dark backgrounds) */
  light?: boolean;
  className?: string;
}

export default function BrandLogo({
  as = "div",
  size = "md",
  light = false,
  className,
}: BrandLogoProps) {
  const iconSize  = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const textSize  = size === "sm" ? "text-sm"  : "text-base";
  const textColor = light ? "text-white" : "text-foreground";

  const inner = (
    <span
      className={cn(
        "flex items-center gap-2 font-semibold tracking-tight",
        textSize,
        textColor,
        className
      )}
    >
      <LayoutDashboard className={cn(iconSize, "text-primary")} />
      Rakamin AI Interview
    </span>
  );

  if (as === "link") {
    return (
      <Link to="/assessments" className="inline-flex">
        {inner}
      </Link>
    );
  }

  return inner;
}
