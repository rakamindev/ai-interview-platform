import { Star, AlertTriangle, MessageSquare, ThumbsUp, Clock, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CandidateFeedback } from "@/types";
import { cn } from "@/lib/utils";

interface CandidateFeedbackCardProps {
  feedback: CandidateFeedback | null;
  loading?: boolean;
}

const TAG_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  smooth: {
    label: "Lancar & Responsif",
    variant: "secondary",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
  technical_issue: {
    label: "Kendala Teknis / Audio",
    variant: "destructive",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  confusing: {
    label: "Pertanyaan Kurang Jelas",
    variant: "secondary",
    className: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  },
  too_long: {
    label: "Durasi Terlalu Lama",
    variant: "secondary",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
  other: {
    label: "Lainnya",
    variant: "outline",
    className: "",
  },
};

export default function CandidateFeedbackCard({
  feedback,
  loading = false,
}: CandidateFeedbackCardProps) {
  if (loading) {
    return (
      <Card className="border border-border/60">
        <CardHeader className="py-4 px-5 border-b">
          <div className="h-4 w-44 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent className="p-5 space-y-3">
          <div className="h-6 w-32 bg-muted animate-pulse rounded" />
          <div className="h-12 w-full bg-muted/50 animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!feedback) {
    return (
      <Card className="border border-dashed border-border/70 bg-card/40">
        <CardContent className="py-6 px-5 flex items-center gap-3 text-muted-foreground">
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
            <Info className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-xs space-y-0.5">
            <p className="font-medium text-foreground">Belum Ada Feedback Kandidat</p>
            <p>Kandidat belum mengisi formulir ulasan atau keluhan untuk sesi ini.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const tagInfo = feedback.experience_tag
    ? TAG_CONFIG[feedback.experience_tag] || {
        label: feedback.experience_tag,
        variant: "outline" as const,
      }
    : null;

  return (
    <Card className="border border-border/60 shadow-xs overflow-hidden">
      <CardHeader className="py-3.5 px-5 bg-muted/20 border-b flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Feedback & Keluhan Kandidat</CardTitle>
        </div>
        {feedback.submitted_at && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {new Date(feedback.submitted_at).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {/* Rating and Experience Tag */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    "h-4 w-4",
                    star <= feedback.rating
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/30 fill-transparent"
                  )}
                />
              ))}
            </div>
            <span className="text-xs font-semibold text-foreground">
              {feedback.rating} / 5
            </span>
          </div>

          {tagInfo && (
            <Badge
              variant={tagInfo.variant}
              className={cn("text-[11px] px-2.5 py-0.5 font-medium border", tagInfo.className)}
            >
              {tagInfo.label}
            </Badge>
          )}
        </div>

        {/* General Feedback Text */}
        {feedback.feedback_text ? (
          <div className="rounded-lg bg-muted/30 border border-border/60 p-3.5 text-xs space-y-1">
            <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <ThumbsUp className="h-3 w-3" />
              <span>Komentar Kandidat:</span>
            </div>
            <p className="text-foreground leading-relaxed italic whitespace-pre-wrap">
              "{feedback.feedback_text}"
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Kandidat tidak menyertakan komentar tertulis tambahan.
          </p>
        )}

        {/* Complaint Section (if filed) */}
        {feedback.has_complaint && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Keluhan / Masalah yang Dilaporkan Kandidat</span>
              <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 py-0 h-4 uppercase tracking-wider">
                Needs Attention
              </Badge>
            </div>
            <p className="text-xs text-foreground/90 bg-background/80 p-3 rounded border border-red-500/20 whitespace-pre-wrap leading-relaxed">
              {feedback.complaint_text || "Tidak ada detail keluhan yang dicantumkan."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

