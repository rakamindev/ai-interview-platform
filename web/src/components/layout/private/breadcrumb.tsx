import { ChevronRight, Home } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export default function PrivateBreadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  // Map known segment ids/words to friendly labels
  const formatSegment = (segment: string): string => {
    if (!isNaN(Number(segment))) return `#${segment}`;
    return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
  };

  return (
    <nav
      aria-label="Breadcrumb"
      className="hidden sm:flex items-center space-x-1 text-xs text-muted-foreground"
    >
      <Link
        to="/assessments"
        className="flex items-center hover:text-foreground transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join("/")}`;
        const isLast = index === segments.length - 1;
        const title = formatSegment(segment);

        return (
          <div key={href} className="flex items-center space-x-1">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            {isLast ? (
              <span className="font-medium text-foreground">{title}</span>
            ) : (
              <Link to={href} className="hover:text-foreground transition-colors">
                {title}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
