import { Outlet, Link, useLocation } from "react-router-dom";
import { useAtomValue } from "jotai";
import { tenantAtom } from "@/stores/tenantAtom";
import { Separator } from "@/components/ui/separator";
import { ClipboardList, Briefcase, Building2 } from "lucide-react";
import { AppBreadcrumbs } from "@/components/layout/AppBreadcrumbs";
import { SidebarLogoutButton } from "@/components/layout/SidebarLogoutButton";
import { HeaderProfileDropdown } from "@/components/layout/HeaderProfileDropdown";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarRail,
} from "@/components/ui/sidebar";

const navItems = [
  { href: "/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/vacancies", label: "Vacancies", icon: Briefcase },
];

export default function AssessorLayout() {
  const tenant = useAtomValue(tenantAtom);
  const location = useLocation();

  // Authenticated account context from active JWT & database organization
  const companyName = tenant.name && tenant.name !== "Demo Tenant" ? tenant.name : "Test Corp";
  const userName = "Admin Assessor";
  const userEmail = "assessor@rakamin.com";
  const userInitials = "AA";

  return (
    <SidebarProvider defaultOpen={true}>
      {/* Left Column: Sidebar */}
      <Sidebar collapsible="icon">
        {/* [Logo Rakamin] */}
        <SidebarHeader className="border-b border-border h-14 flex flex-row items-center justify-start px-4 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
          <Link to="/assessments" className="flex items-center gap-2.5 min-w-0 group-data-[collapsible=icon]:justify-center">
            <img
              src="/logo.png"
              alt="Rakamin Logo"
              className="h-6 w-6 object-contain shrink-0"
            />
            <span className="font-semibold text-sm truncate group-data-[collapsible=icon]:hidden">
              Rakamin AI Interview
            </span>
          </Link>
        </SidebarHeader>

        {/* [Navigation Items: Assessments & Vacancies] */}
        <SidebarContent>
          <SidebarGroup className="p-2 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:py-2">
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map(({ href, label, icon: Icon }) => {
                  const isActive = location.pathname.startsWith(href);
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={label}
                      >
                        <Link
                          to={href}
                          className="flex items-center gap-2.5 group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate group-data-[collapsible=icon]:hidden">{label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* [Bottom Sidebar: Separated Logout Component] */}
        <SidebarFooter className="p-2 border-t border-border mt-auto group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:py-2">
          <SidebarLogoutButton />
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      {/* Right Column: Account Header & Main Content */}
      <SidebarInset className="flex flex-col min-h-screen">
        {/* [Top Header: Sidebar Trigger, Breadcrumbs & Account Information] */}
        <header className="h-14 border-b border-border bg-white sticky top-0 z-30 flex items-center justify-between px-3 md:px-4">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4 bg-border" />
            <AppBreadcrumbs />
          </div>

          {/* Account Information Header in English */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0 ml-2 md:ml-4">
            {/* Company Badge */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-muted/60 border border-border text-xs font-medium text-foreground">
              <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{companyName}</span>
            </div>

            {/* User Profile Dropdown */}
            <div className="flex items-center lg:pl-3 lg:border-l lg:border-border">
              <HeaderProfileDropdown
                userName={userName}
                userEmail={userEmail}
                userInitials={userInitials}
                companyName={companyName}
              />
            </div>
          </div>
        </header>

        {/* [Content Area] */}
        <main className="flex-1 w-full p-4 md:p-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
