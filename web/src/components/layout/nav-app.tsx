import { Link } from "@tanstack/react-router";
import { Briefcase, ClipboardList } from "lucide-react";

export function NavApp() {
  return (
    <nav aria-label="navigation" className="hidden min-w-0 flex-1 md:block">
      <ol className="flex flex-nowrap items-center gap-2">
        <li className="inline-flex items-center">
          <Link
            to="/assessments"
            className="relative flex h-13 w-full items-center gap-2 overflow-hidden px-3 py-1.5 text-center text-sm font-medium ring-sidebar-ring outline-hidden transition-[width,height,padding] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary after:opacity-0 after:transition-opacity hover:text-primary focus-visible:ring-2 aria-[current=page]:text-primary aria-[current=page]:after:opacity-100 [&_svg]:size-4 [&_svg]:shrink-0"
          >
            <ClipboardList />
            Assessments
          </Link>
        </li>

        <li className="inline-flex items-center">
          <Link
            to="/vacancies"
            className="relative flex h-13 w-full items-center gap-2 overflow-hidden px-3 py-1.5 text-center text-sm font-medium ring-sidebar-ring outline-hidden transition-[width,height,padding] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary after:opacity-0 after:transition-opacity hover:text-primary focus-visible:ring-2 aria-[current=page]:text-primary aria-[current=page]:after:opacity-100 [&_svg]:size-4 [&_svg]:shrink-0"
          >
            <Briefcase />
            Vacancies
          </Link>
        </li>
      </ol>
    </nav>
  );
}
