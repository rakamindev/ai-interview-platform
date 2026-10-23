import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, ShieldCheck } from "lucide-react";

interface EndSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export const EndSessionModal: React.FC<EndSessionModalProps> = ({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border text-foreground shadow-2xl rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">Akhiri Sesi Wawancara?</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Konfirmasi penyelesaian wawancara kompetensi</p>
            </div>
          </div>
          <DialogDescription className="text-muted-foreground mt-3 text-xs leading-relaxed">
            Apakah Anda yakin ingin mengakhiri sesi ini? Seluruh rekaman suara, transkrip percakapan, dan bukti kompetensi Anda akan disimpan secara aman. Sistem AI akan langsung memproses kalkulasi portofolio dan evaluasi asesmen Anda.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 p-3 bg-muted/50 rounded-xl border border-border/70 flex items-start gap-2.5 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <span>
            Data Anda dilindungi sesuai standar privasi UU PDP dan hanya dapat diakses oleh tim rekrutmen yang berwenang.
          </span>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="text-xs rounded-xl"
          >
            Lanjutkan Wawancara
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold rounded-xl shadow-md"
          >
            {isSubmitting ? "Mengakhiri..." : "Ya, Selesaikan Wawancara"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EndSessionModal;
