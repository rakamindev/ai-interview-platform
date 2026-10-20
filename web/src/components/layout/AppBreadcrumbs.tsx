import { Fragment } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function AppBreadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);

  const items: { label: string; href?: string }[] = [];

  if (parts[0] === "assessments") {
    items.push({ label: "Assessments", href: "/assessments" });

    const id = parts[1];
    if (id === "new") {
      items.push({ label: "New Assessment" });
    } else if (id) {
      const sub = parts[2]; // 'invite', 'edit', 'sessions'
      if (sub === "edit") {
        items.push({ label: "Edit Assessment" });
      } else if (sub === "invite") {
        items.push({ label: "Detail" });
      } else if (sub === "sessions") {
        const sessionId = parts[3];
        const page = parts[4]; // 'portfolio', 'fitgap', 'transcript', 'monitor'

        // Tingkat induk: Detail Asesmen
        items.push({ label: "Detail", href: `/assessments/${id}/invite` });

        if (page === "monitor") {
          items.push({ label: "Live Monitor" });
        } else if (page === "portfolio") {
          items.push({ label: "Portfolio" });
        } else if (page === "transcript") {
          items.push({ label: "Portfolio", href: `/assessments/${id}/sessions/${sessionId}/portfolio` });
          items.push({ label: "Transcript" });
        } else if (page === "fitgap") {
          items.push({ label: "Portfolio", href: `/assessments/${id}/sessions/${sessionId}/portfolio` });
          items.push({ label: "Fit-Gap Analysis" });
        }
      }
    }
  } else if (parts[0] === "vacancies") {
    items.push({ label: "Vacancies", href: "/vacancies" });
    if (parts[1] === "new") {
      items.push({ label: "New Vacancy" });
    } else if (parts[2] === "edit") {
      items.push({ label: "Edit Vacancy" });
    }
  }

  if (items.length === 0) return null;

  // Jika item 2 atau kurang, tampilkan normal
  if (items.length <= 2) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <Fragment key={index}>
                <BreadcrumbItem>
                  {isLast || !item.href ? (
                    <BreadcrumbPage className="truncate max-w-[130px] sm:max-w-none">{item.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link to={item.href} className="truncate max-w-[120px] sm:max-w-none">{item.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  // Jika item > 2:
  // Desktop: tampilkan semua
  // Mobile: tampilkan First > ... (DropdownMenu) > Last
  const firstItem = items[0];
  const lastItem = items[items.length - 1];
  const intermediateItems = items.slice(1, -1);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {/* Item Pertama (selalu tampil) */}
        <BreadcrumbItem>
          {firstItem.href ? (
            <BreadcrumbLink asChild>
              <Link to={firstItem.href}>{firstItem.label}</Link>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{firstItem.label}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        <BreadcrumbSeparator />

        {/* Mobile & Tablet: Ellipsis dengan DropdownMenu untuk item tengah */}
        <BreadcrumbItem className="lg:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 focus:outline-none" aria-label="Toggle intermediate breadcrumbs">
              <BreadcrumbEllipsis />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[10rem]">
              {intermediateItems.map((item, idx) => (
                <DropdownMenuItem key={idx} asChild>
                  {item.href ? (
                    <Link to={item.href} className="cursor-pointer">{item.label}</Link>
                  ) : (
                    <span>{item.label}</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="lg:hidden" />

        {/* Desktop: Render item tengah secara utuh */}
        {intermediateItems.map((item, idx) => (
          <Fragment key={idx}>
            <BreadcrumbItem className="hidden lg:inline-flex">
              {item.href ? (
                <BreadcrumbLink asChild>
                  <Link to={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden lg:inline-flex" />
          </Fragment>
        ))}

        {/* Item Terakhir / Halaman Aktif (selalu tampil) */}
        <BreadcrumbItem>
          <BreadcrumbPage className="truncate max-w-[130px] sm:max-w-none">{lastItem.label}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
