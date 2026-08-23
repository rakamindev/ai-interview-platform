import { useState } from "react";
import { Building2, ChevronDown, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { buttonVariants } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

interface AccountMenuProps {
  tenantName: string | null;
  onLogout: () => void;
}

export default function AccountMenu({
  tenantName,
  onLogout,
}: AccountMenuProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 sm:px-3 py-1.5 text-sm text-muted-foreground",
            "transition-colors hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          )}
        >
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline max-w-[10rem] truncate">
            {tenantName ?? "No tenant"}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 duration-300">
          <DropdownMenuLabel className="truncate">{tenantName ?? "No tenant"}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
            onSelect={() => setConfirmOpen(true)}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll be signed out and returned to the login page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={onLogout}
            >
              Log out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
