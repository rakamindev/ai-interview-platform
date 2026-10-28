import { useState, useEffect } from "react";
import { Star, AlertTriangle, CheckCircle, MessageSquare, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading";
import { feedbackApi, type SubmitFeedbackPayload } from "@/services/feedback";
import { cn } from "@/lib/utils";

interface CandidateFeedbackFormProps {
  token: string;
  onSuccess?: () => void;
  alreadySubmitted?: boolean;
}

const EXPERIENCE_OPTIONS = [
  { value: "smooth", label: "Lancar & Responsif", icon: "✨" },
  { value: "technical_issue", label: "Kendala Teknis / Audio", icon: "⚠️" },
  { value: "confusing", label: "Pertanyaan Kurang Jelas", icon: "❓" },
  { value: "too_long", label: "Durasi Terlalu Lama", icon: "⏳" },
  { value: "other", label: "Lainnya", icon: "💬" },
];

const RATING_DESCRIPTIONS: Record<number, string> = {
  1: "Sangat Buruk / Very Poor",
  2: "Kurang Memuaskan / Poor",
  3: "Cukup Baik / Neutral",
  4: "Bagus & Menyenangkan / Good",
  5: "Sangat Memuaskan / Excellent",
};

export default function CandidateFeedbackForm({
  token,
  onSuccess,
  alreadySubmitted = false,
}: CandidateFeedbackFormProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [experienceTag, setExperienceTag] = useState<string>("smooth");
  const [feedbackText, setFeedbackText] = useState("");
  const [hasComplaint, setHasComplaint] = useState(false);
  const [complaintText, setComplaintText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(alreadySubmitted ?? false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync submitted state when alreadySubmitted prop updates asynchronously
  // (candidateInfo loads after mount, so initial prop value may be undefined)
  useEffect(() => {
    if (alreadySubmitted) {
      setSubmitted(true);
    }
  }, [alreadySubmitted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating || rating < 1 || rating > 5) {
      setErrorMsg("Mohon berikan rating bintang terlebih dahulu.");
      return;
    }

    if (hasComplaint && !complaintText.trim()) {
      setErrorMsg("Mohon jelaskan keluhan Anda pada kolom yang disediakan.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const payload: SubmitFeedbackPayload = {
      rating,
      experience_tag: experienceTag,
      feedback_text: feedbackText.trim() || undefined,
      has_complaint: hasComplaint,
      complaint_text: hasComplaint ? complaintText.trim() : undefined,
    };

    try {
      await feedbackApi.submit(token, payload);
      setSubmitted(true);
      onSuccess?.();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Gagal mengirimkan feedback. Silakan coba lagi.";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm text-center space-y-3 animate-in fade-in zoom-in-95 duration-300">
        <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
          <CheckCircle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          Terima Kasih Atas Masukan Anda!
        </h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
          Feedback dan keluhan Anda telah tercatat dengan aman. Masukan ini sangat berharga bagi tim rekruter untuk mengevaluasi dan meningkatkan proses interview berikutnya.
        </p>
      </div>
    );
  }

  const activeRating = hoverRating || rating;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm text-left space-y-5 animate-in fade-in duration-300">
      <div className="border-b pb-4">
        <div className="flex items-center gap-2 text-foreground font-semibold text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>Feedback & Evaluasi Sesi Interview</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Bantu kami meningkatkan kualitas platform dengan membagikan pengalaman Anda selama proses wawancara.
        </p>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Rating Stars */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground">
            Bagaimana penilaian Anda secara keseluruhan terhadap wawancara ini? <span className="text-destructive">*</span>
          </Label>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="p-1 rounded hover:scale-110 transition-transform focus:outline-none"
                  aria-label={`${star} star`}
                >
                  <Star
                    className={cn(
                      "h-6 w-6 transition-colors",
                      star <= activeRating
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/30 fill-transparent"
                    )}
                  />
                </button>
              ))}
            </div>
            {activeRating > 0 && (
              <span className="text-xs font-medium text-muted-foreground ml-2">
                {RATING_DESCRIPTIONS[activeRating]}
              </span>
            )}
          </div>
        </div>

        {/* Experience Tag Pills */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground">
            Apa yang paling menggambarkan pengalaman Anda?
          </Label>
          <div className="flex flex-wrap gap-2">
            {EXPERIENCE_OPTIONS.map((opt) => {
              const isSelected = experienceTag === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setExperienceTag(opt.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-muted/30 text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                  )}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* General Feedback Text */}
        <div className="space-y-2">
          <Label htmlFor="feedback-text" className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Komentar & Saran Tambahan (Opsional)</span>
          </Label>
          <Textarea
            id="feedback-text"
            rows={3}
            placeholder="Tuliskan saran atau komentar Anda tentang interaksi dengan AI, pertanyaan yang diajukan, dsb..."
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            className="text-xs resize-none"
          />
        </div>

        {/* Complaint Section Toggle */}
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5 space-y-3">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasComplaint}
              onChange={(e) => setHasComplaint(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-ring"
            />
            <div className="text-xs">
              <span className="font-semibold text-foreground">
                Saya ingin mengajukan keluhan / kendala teknis resmi
              </span>
              <p className="text-muted-foreground mt-0.5">
                Centang opsi ini jika Anda mengalami kendala fatal (audio terputus, gangguan sistem, atau penilaian yang tidak adil) agar ditinjau prioritas oleh tim penilai.
              </p>
            </div>
          </label>

          {hasComplaint && (
            <div className="space-y-2 pt-2 border-t border-border/60 animate-in fade-in duration-200">
              <Label htmlFor="complaint-text" className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Rincian Keluhan / Kendala yang Dialami <span className="text-destructive">*</span></span>
              </Label>
              <Textarea
                id="complaint-text"
                rows={3}
                required
                placeholder="Jelaskan secara detail kendala yang Anda alami saat sesi wawancara berlangsung..."
                value={complaintText}
                onChange={(e) => setComplaintText(e.target.value)}
                className="text-xs border-amber-500/40 focus-visible:ring-amber-500 resize-none bg-background"
              />
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={submitting}
            className="gap-2 text-xs h-9 px-5"
          >
            {submitting ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Mengirim...</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>Kirim Feedback</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

