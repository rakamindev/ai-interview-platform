import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, clearToken } from "@/stores/authAtom";
import { Building2, LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface HeaderProfileDropdownProps {
  userName: string;
  userEmail: string;
  userInitials: string;
  companyName: string;
}

export function HeaderProfileDropdown({
  userName,
  userEmail,
  userInitials,
  companyName,
}: HeaderProfileDropdownProps) {
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null });
    navigate("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="User account menu"
          className="flex items-center gap-2.5 focus:outline-none rounded-sm p-0.5 hover:bg-muted/50 transition-colors"
        >
          {/* On desktop: show name & email; on mobile/tablet: hidden so only the avatar is visible */}
          <div className="hidden lg:flex flex-col text-right">
            <span className="text-xs font-semibold leading-tight text-foreground">{userName}</span>
            <span className="text-[11px] text-muted-foreground leading-tight">{userEmail}</span>
          </div>

          {/* Avatar button */}
          <div className="h-8 w-8 bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs uppercase shrink-0 hover:bg-primary/20 transition-colors cursor-pointer">
            {userInitials}
          </div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-lg">
        {/* User Details */}
        <div className="flex flex-col space-y-1 p-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
              {userInitials}
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-xs font-semibold leading-tight text-foreground truncate">{userName}</p>
              <p className="text-[11px] text-muted-foreground leading-tight truncate">{userEmail}</p>
            </div>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Company context */}
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
          <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="truncate">
            Org: <strong className="text-foreground font-medium">{companyName}</strong>
          </span>
        </div>

        <DropdownMenuSeparator />

        {/* Logout action */}
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer text-xs font-medium py-1.5"
        >
          <LogOut className="h-3.5 w-3.5 mr-2" />
          Log Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
