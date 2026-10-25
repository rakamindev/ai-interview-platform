import { useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { tenantAtom, clearTenant, defaultTenant } from "@/stores/tenantAtom";
import { authAtom, clearToken } from "@/stores/authAtom";
import { queryClient } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Building2 } from "lucide-react";
import { toast } from "sonner";
import { getInitialProfile } from "./utils";

export default function PrivateNavMenu() {
  const tenant = useAtomValue(tenantAtom);
  const setTenant = useSetAtom(tenantAtom);
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();

  const handleLogout = () => {
    clearToken();
    clearTenant();
    queryClient.clear();
    setAuth({ token: null });
    setTenant(defaultTenant);
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const displayName = tenant.name ? `${tenant.name} Assessor` : "Assessor";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-8 w-8 min-h-8 min-w-8 items-center justify-center overflow-hidden rounded-full border border-primary/30 bg-primary/10 text-xs font-bold text-primary transition-all duration-200 select-none cursor-pointer hover:ring-2 hover:ring-primary/20"
          aria-label="User Menu"
        >
          {getInitialProfile(displayName)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1 rounded-xl shadow-xl">
        <DropdownMenuLabel className="font-normal p-2">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-semibold leading-none text-foreground">
              {displayName}
            </p>
            {tenant.name && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
                <Building2 className="h-3 w-3" />
                <span>Tenant: {tenant.name}</span>
              </div>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer gap-2"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
