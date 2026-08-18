import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

interface LogoutModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function LogoutModal({ open, onConfirm, onCancel }: LogoutModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogPortal>
        {/* Lighter overlay — default bg-black/80 is too dark */}
        <DialogOverlay className="bg-black/10" />
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-sm rounded-lg [&>button]:hidden">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <LogOut className="h-5 w-5 text-muted-foreground" />
              </div>
              <DialogTitle>Sign out</DialogTitle>
            </div>
            <DialogDescription>
              Are you sure you want to sign out? Any unsaved changes will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row justify-end gap-2 sm:gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirm}>
              Sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
