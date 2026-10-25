import React, { useState } from "react";
import { ShieldCheck, Globe, Loader2, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { sessionsApi } from "@/services/sessions";

interface ConsentModalProps {
  token: string;
  roleTitle?: string;
  onConsentSuccess: () => void;
}

type Lang = "id" | "en";

interface ConsentCopy {
  title: string;
  subtitle: string;
  badgeLegal: string;
  badgeVersion: string;
  intro: string;
  item1Title: string;
  item1Desc: string;
  item2Title: string;
  item2Desc: string;
  item3Title: string;
  item3Desc: string;
  submitBtn: string;
  submittingBtn: string;
  optOutNotice: string;
  errorGeneric: string;
}

const COPY: Record<Lang, ConsentCopy> = {
  id: {
    title: "Persetujuan Pemrosesan Data Pribadi & Rekaman Suara",
    subtitle: "Kepatuhan terhadap Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)",
    badgeLegal: "Kepatuhan UU PDP",
    badgeVersion: "Versi Kebijakan: 2026.1",
    intro:
      "Sebelum memulai asesmen wawancara AI, Anda wajib memberikan persetujuan eksplisit atas pemrosesan data pribadi spesifik berupa data biometrik suara dan evaluasi kompetensi berbasis AI sesuai ketentuan hukum yang berlaku.",
    item1Title: "Pemrosesan Biometrik Suara & Perekaman Audio",
    item1Desc:
      "Saya menyetujui perekaman suara dan pengaliran audio 16kHz secara aman dan terenkripsi untuk diproses secara langsung oleh model AI Google Gemini Live selama durasi wawancara.",
    item2Title: "Evaluasi Berbantuan AI & Pengawasan Asesor Manusia (Pasal 10)",
    item2Desc:
      "Saya memahami bahwa model AI bertindak sebagai instrumen pengumpul bukti kompetensi, dan seluruh penilaian kompetensi akhir serta keputusan seleksi tetap berada di bawah kendali dan pengawasan asesor manusia (human-in-the-loop).",
    item3Title: "Kerahasiaan, Retensi Data & Hak Penarikan / Penghapusan",
    item3Desc:
      "Saya menyetujui penyimpanan rekaman dan transkrip wawancara untuk keperluan evaluasi rekrutmen ini, serta memahami hak saya untuk mengakses, memperbaiki, atau meminta penghapusan data pribadi saya sesuai ketentuan UU PDP.",
    submitBtn: "Setujui & Lanjutkan ke Pemeriksaan Perangkat",
    submittingBtn: "Mencatat Persetujuan...",
    optOutNotice:
      "Jika Anda tidak menyetujui ketentuan ini, Anda dapat menutup halaman ini dan menghubungi tim rekrutmen organisasi terkait untuk alternatif metode asesmen.",
    errorGeneric: "Gagal menyimpan persetujuan. Silakan coba kembali atau periksa koneksi Anda.",
  },
  en: {
    title: "Personal Data Processing & Audio Recording Consent",
    subtitle: "Compliance with Indonesian Personal Data Protection Law (UU No. 27/2022)",
    badgeLegal: "UU PDP Compliant",
    badgeVersion: "Policy Version: 2026.1",
    intro:
      "Before commencing this AI-assisted interview assessment, explicit informed consent is required for processing sensitive biometric voice data and automated competency evaluation under applicable Indonesian privacy regulations.",
    item1Title: "Voice Biometric Processing & Audio Streaming",
    item1Desc:
      "I consent to the real-time recording and 16kHz PCM audio streaming of my voice via Google Gemini Live AI under encrypted transmission for the duration of this assessment.",
    item2Title: "AI-Assisted Evaluation & Human Oversight (Article 10)",
    item2Desc:
      "I understand that AI serves strictly as an objective evidence collection instrument, with all final competency ratings and employment decisions subject to human assessor review and sovereignty.",
    item3Title: "Confidentiality, Retention & Erasure Rights",
    item3Desc:
      "I agree to the secure, confidential retention of interview transcripts and evidence for recruitment evaluation, and acknowledge my statutory right to request data access, correction, or erasure under UU PDP.",
    submitBtn: "I Consent & Proceed to Hardware Diagnostic",
    submittingBtn: "Recording Consent...",
    optOutNotice:
      "If you do not wish to consent, please exit this page and contact the recruiting organization to request alternative assessment accommodations.",
    errorGeneric: "Failed to record consent. Please try again or check your internet connection.",
  },
};

export default function ConsentModal({ token, roleTitle, onConsentSuccess }: ConsentModalProps) {
  const [lang, setLang] = useState<Lang>("id");
  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);
  const [consent3, setConsent3] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = COPY[lang];
  const allConsented = consent1 && consent2 && consent3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allConsented || loading) return;

    setLoading(true);
    setError(null);

    try {
      await sessionsApi.submitConsent(token, { terms_version: "2026.1" });
      onConsentSuccess();
    } catch (err: unknown) {
      const errorMsg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setError(errorMsg || t.errorGeneric);
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border shadow-sm rounded-xl p-6 sm:p-8 space-y-6">
      {/* Header with Title and Language Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t.badgeLegal}
            </span>
            <Badge variant="outline" className="text-xs">
              {t.badgeVersion}
            </Badge>
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            {t.title}
          </h2>
          {roleTitle && (
            <p className="text-xs font-medium text-muted-foreground">
              Posisi / Position: <span className="text-foreground">{roleTitle}</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">{t.subtitle}</p>
        </div>

        {/* Language Switcher */}
        <div className="inline-flex items-center self-start bg-muted p-1 rounded-lg text-xs font-medium shrink-0">
          <Globe className="h-3.5 w-3.5 ml-1.5 mr-1 text-muted-foreground" />
          <button
            type="button"
            onClick={() => setLang("id")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              lang === "id"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Bahasa Indonesia
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              lang === "en"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            English
          </button>
        </div>
      </div>

      {/* Legal Disclosure Brief */}
      <div className="bg-muted/40 rounded-lg p-4 text-xs sm:text-sm text-muted-foreground leading-relaxed flex items-start gap-3">
        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p>{t.intro}</p>
      </div>

      {/* Consent Checkboxes */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3.5">
          {/* Checkbox 1: Biometric Audio Processing */}
          <label className="flex items-start gap-3.5 p-3.5 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors select-none">
            <input
              type="checkbox"
              checked={consent1}
              onChange={(e) => setConsent1(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
            />
            <div className="space-y-1">
              <span className="text-sm font-medium text-foreground block">
                1. {t.item1Title}
              </span>
              <span className="text-xs text-muted-foreground leading-normal block">
                {t.item1Desc}
              </span>
            </div>
          </label>

          {/* Checkbox 2: AI Evaluation & Human Oversight */}
          <label className="flex items-start gap-3.5 p-3.5 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors select-none">
            <input
              type="checkbox"
              checked={consent2}
              onChange={(e) => setConsent2(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
            />
            <div className="space-y-1">
              <span className="text-sm font-medium text-foreground block">
                2. {t.item2Title}
              </span>
              <span className="text-xs text-muted-foreground leading-normal block">
                {t.item2Desc}
              </span>
            </div>
          </label>

          {/* Checkbox 3: Confidentiality & Erasure Rights */}
          <label className="flex items-start gap-3.5 p-3.5 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors select-none">
            <input
              type="checkbox"
              checked={consent3}
              onChange={(e) => setConsent3(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
            />
            <div className="space-y-1">
              <span className="text-sm font-medium text-foreground block">
                3. {t.item3Title}
              </span>
              <span className="text-xs text-muted-foreground leading-normal block">
                {t.item3Desc}
              </span>
            </div>
          </label>
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
            {error}
          </div>
        )}

        <div className="pt-2 space-y-3">
          <Button
            type="submit"
            disabled={!allConsented || loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t.submittingBtn}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {t.submitBtn}
              </>
            )}
          </Button>

          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            {t.optOutNotice}
          </p>
        </div>
      </form>
    </div>
  );
}
