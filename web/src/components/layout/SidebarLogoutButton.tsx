import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { authAtom, clearToken } from "@/stores/authAtom";
import { LogOut } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export function SidebarLogoutButton() {
  const setAuth = useSetAtom(authAtom);
  const navigate = useNavigate();

  const handleLogout = () => {
    clearToken();
    setAuth({ token: null });
    navigate("/login");
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <SidebarMenuButton
              tooltip="Log Out"
              className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/15 gap-2.5 font-medium transition-colors group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:!p-0"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="truncate group-data-[collapsible=icon]:hidden">
                Log Out
              </span>
            </SidebarMenuButton>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to log out? Your active session will be ended.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleLogout}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Log Out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
