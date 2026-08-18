import { Button } from "@/components/ui/button";
import {
  Mic,
  Clock,
  MessageSquare,
  Volume2,
  WifiHigh,
  ChevronRight,
} from "lucide-react";
import type { CandidateInfo } from "@/types";

interface InterviewPrepProps {
  candidateInfo: CandidateInfo;
  onContinue: () => void;
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  id: "Bahasa Indonesia",
};

const tips = [
  {
    icon: Mic,
    title: "Gunakan mikrofon yang jelas",
    desc: "Pastikan kamu berada di tempat yang tenang dan mikrofon tidak terhalang.",
  },
  {
    icon: MessageSquare,
    title: "Jawab dengan contoh nyata",
    desc: "AI akan bertanya lebih dalam tentang pengalamanmu — siapkan contoh spesifik dari pekerjaan sebelumnya.",
  },
  {
    icon: Volume2,
    title: "Bicara dengan jelas dan natural",
    desc: "Tidak perlu terburu-buru. Bicara seperti kamu berdiskusi dengan kolega.",
  },
  {
    icon: WifiHigh,
    title: "Koneksi internet stabil",
    desc: "Gunakan WiFi atau data yang stabil. Hindari area dengan sinyal lemah.",
  },
];

export default function InterviewPrep({ candidateInfo, onContinue }: InterviewPrepProps) {
  const langLabel =
    LANGUAGE_LABELS[(candidateInfo as any).language] ?? "English";

  return (
    <div className="max-w-xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold leading-tight">
          {candidateInfo.role_title}
        </h1>
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground mt-1">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {candidateInfo.time_limit_min} menit
          </span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
          <span>Voice Interview</span>
        </div>
      </div>

      {/* About this interview */}
      <div className="rounded-xl border bg-muted/30 p-5 space-y-3">
        <h2 className="text-sm font-semibold">Tentang interview ini</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="text-foreground">•</span>
            <span>
              Wawancara dilakukan sepenuhnya oleh AI secara percakapan suara.
              Tidak ada pertanyaan yang tertulis — AI akan bereaksi langsung
              terhadap jawabanmu.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-foreground">•</span>
            <span>
              AI akan menggali lebih dalam setiap jawaban dengan pertanyaan
              lanjutan. Fokus pada pengalaman konkret, bukan teori.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-foreground">•</span>
            <span>
              Sesi akan berlangsung hingga{" "}
              <strong>{candidateInfo.time_limit_min} menit</strong>. Kamu bisa
              mengakhiri lebih awal kapan saja.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-foreground">•</span>
            <span>
              Seluruh percakapan direkam dan dianalisis otomatis setelah sesi
              selesai.
            </span>
          </li>
        </ul>
      </div>

      {/* Tips */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Tips sebelum mulai</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tips.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border bg-card p-4 flex gap-3"
            >
              <div className="shrink-0 mt-0.5">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="pt-2">
        <Button size="lg" className="w-full" onClick={onContinue}>
          Lanjutkan ke Pengecekan Perangkat
          <ChevronRight className="h-4 w-4 ml-1.5" />
        </Button>
        <p className="text-center text-xs text-muted-foreground mt-3">
          Dengan melanjutkan, kamu setuju bahwa sesi ini direkam dan dianalisis.
        </p>
      </div>
    </div>
  );
}
