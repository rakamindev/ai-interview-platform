import {Link, Outlet, useLocation, useNavigate} from "react-router-dom";
import {useAtomValue, useSetAtom} from "jotai";
import {clearTenant, tenantAtom} from "@/stores/tenantAtom";
import {authAtom, clearToken} from "@/stores/authAtom";
import {Briefcase, ClipboardList, LayoutDashboard, LogOut} from "lucide-react";
import {cn} from "@/lib/utils";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

const navItems = [
    {href: "/assessments", label: "Assessments", icon: ClipboardList},
    {href: "/vacancies", label: "Vacancies", icon: Briefcase},
];

export default function AssessorLayout() {
    const tenant = useAtomValue(tenantAtom);
    const setAuth = useSetAtom(authAtom);
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        clearToken();
        clearTenant();
        setAuth({token: null});
        navigate("/login");
    };

    return (
        <div className="min-h-screen flex flex-col bg-background">
            {/* Top header */}
            <header className="border-b bg-white sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Link to="/assessments" className="flex items-center gap-2">
                            <LayoutDashboard className="h-5 w-5 text-primary"/>
                            <span className="hidden md:block font-semibold text-sm">Rakamin AI Interview</span>
                        </Link>
                        <nav className="flex items-center gap-1">
                            {navItems.map(({href, label, icon: Icon}) => (
                                <Link
                                    key={href}
                                    to={href}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                                        location.pathname.startsWith(href)
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <Icon className="h-4 w-4"/>
                                    {label}
                                </Link>
                            ))}
                        </nav>
                    </div>
                    <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                            <button className="text-xs text-muted-foreground border rounded-full px-2.5 py-0.5 hover:bg-accent">
                                {tenant.name}
                            </button>
                        </DropdownMenu.Trigger>

                        <DropdownMenu.Portal>
                            <DropdownMenu.Content
                                align="end"
                                className="z-50 min-w-40 mt-2 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                            >
                                <DropdownMenu.Item
                                    onClick={handleLogout}
                                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground"
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Logout
                                </DropdownMenu.Item>
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                </div>
            </header>

            {/* Page content */}
            <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
                <Outlet/>
            </main>
        </div>
    );
}
