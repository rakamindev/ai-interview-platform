import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";

type Labels = Record<string, string>;
const BreadcrumbContext = createContext<{ labels: Labels; setLabel: (key: string, label: string) => void }>({ labels: {}, setLabel: () => {} });

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<Labels>({});
  const [setLabel] = useState(() => (key: string, label: string) => {
    setLabels((current) => current[key] === label ? current : { ...current, [key]: label });
  });
  return <BreadcrumbContext.Provider value={{ labels, setLabel }}>{children}</BreadcrumbContext.Provider>;
}

/** Reuse names already loaded by the page; never fetch data just for navigation. */
export function useBreadcrumbLabel(key: string, label?: string | null) {
  const { setLabel } = useContext(BreadcrumbContext);
  useEffect(() => { if (label) setLabel(key, label); }, [key, label, setLabel]);
}

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const { labels } = useContext(BreadcrumbContext);
  const parts = pathname.split("/").filter(Boolean);
  const vacancy = parts[0] === "vacancies";
  const base = vacancy ? "/vacancies" : "/assessments";
  const items: { label: string; href?: string }[] = [{ label: vacancy ? "Vacancies" : "Assessments", href: base }];
  if (parts[1] === "new") items.push({ label: vacancy ? "New vacancy" : "New assessment" });
  else if (parts[1]) {
    items.push({ label: labels[`${parts[0]}:${parts[1]}`] || `${vacancy ? "Vacancy" : "Assessment"} #${parts[1]}`, href: vacancy ? undefined : `${base}/${parts[1]}/invite` });
    if (parts[2] === "edit") items.push({ label: "Edit" });
    if (parts[2] === "sessions") {
      items.push({ label: labels[`sessions:${parts[3]}`] || `Session #${parts[3]}`, href: `${base}/${parts[1]}/sessions/${parts[3]}/portfolio` });
      items.push({ label: ({ portfolio: "Portfolio", transcript: "Transcript", monitor: "Live interview", fitgap: "Fit/gap analysis" } as Record<string, string>)[parts[4]] || "Session" });
    }
  }
  return (
    <nav aria-label="Breadcrumb" className="min-h-14 border-b px-4 py-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex min-w-0 max-w-full items-center gap-2">
            {index > 0 && <ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0" />}
            {index === items.length - 1 ? <span aria-current="page" className="font-medium text-foreground break-words">{item.label}</span>
              : item.href ? <Link className="truncate max-w-48 hover:text-foreground hover:underline sm:max-w-64" title={item.label} to={item.href}>{item.label}</Link>
              : <span className="truncate max-w-48" title={item.label}>{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
