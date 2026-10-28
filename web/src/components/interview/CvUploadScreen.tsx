import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/common/BackButton";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  Sparkles,
} from "lucide-react";
import { sessionsApi } from "@/services/sessions";

/**
 * The API reports failures as { errors: [{ status, message }] } (see Response#json_error),
 * so read that shape first and keep the flatter { error } shape as a fallback.
 */
const apiErrorMessage = (err: unknown): string | undefined => {
  const data = (err as { response?: { data?: unknown } })?.response?.data as
    | { errors?: Array<{ message?: string }>; error?: string }
    | undefined;
  return data?.errors?.[0]?.message ?? data?.error;
};

interface CvUploadScreenProps {
  token: string;
  hasExistingCv?: boolean;
  existingFilename?: string | null;
  onSuccess: () => void;
  onSkip?: () => void;
  onBack?: () => void;
}

export const CvUploadScreen: React.FC<CvUploadScreenProps> = ({
  token,
  hasExistingCv = false,
  existingFilename,
  onSuccess,
  onSkip,
  onBack,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(hasExistingCv);
  const [uploadedName, setUploadedName] = useState<string | null>(existingFilename || null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("File exceeds 5MB limit. Please upload a smaller document.");
      return;
    }
    const validExtensions = [".pdf", ".txt"];
    const hasValidExt = validExtensions.some((ext) =>
      selectedFile.name.toLowerCase().endsWith(ext)
    );
    if (!hasValidExt && !["application/pdf", "text/plain"].includes(selectedFile.type)) {
      setError("Only PDF and TXT files are supported.");
      return;
    }
    setError(null);
    setFile(selectedFile);
  };

  const handleUploadAndProceed = async () => {
    if (!file) {
      if (uploaded) {
        onSuccess();
      }
      return;
    }

    setUploading(true);
    setError(null);
    setWarning(null);

    try {
      const res = await sessionsApi.uploadCv(token, file);
      setUploaded(true);
      setUploadedName(res.data.filename);
      // The file is stored either way; this only warns that the résumé will not
      // personalize the interview (e.g. a scanned/image-only PDF).
      if (res.data.text_extracted === false) {
        setWarning(
          "We saved your CV but couldn't read any text from it. If it's a scan or image-only PDF, upload a text-based version for a more personalized interview — or continue as is."
        );
      }
      onSuccess();
    } catch (err: unknown) {
      setError(apiErrorMessage(err) || "Failed to upload and parse CV. You can retry or proceed without it.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-300">
      {onBack && (
        <div className="flex items-center justify-start mb-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-xs">
            ← Back to System Check
          </Button>
        </div>
      )}

      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium mb-1">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Personalized Interview Experience</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Upload Your CV / Résumé
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          The AI interviewer parses your actual background to ask relevant, project-specific technical questions rather than generic theory.
        </p>
      </div>

      {uploaded && !file && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-medium text-emerald-900">CV Ready for Interview</p>
              <p className="text-xs text-emerald-700">{uploadedName || "Your CV is already attached."}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs bg-white hover:bg-slate-50"
          >
            Replace
          </Button>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
          dragOver
            ? "border-indigo-500 bg-indigo-50/60 scale-[1.01]"
            : "border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && validateAndSetFile(e.target.files[0])}
        />

        <div className="flex flex-col items-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-indigo-100/80 text-indigo-600 flex items-center justify-center shadow-xs">
            <UploadCloud className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {file ? file.name : "Click to select or drag and drop your résumé"}
            </p>
            <p className="text-xs text-muted-foreground">PDF or plain text up to 5MB</p>
          </div>
        </div>
      </div>

      {file && (
        <div className="flex items-center justify-between p-3.5 bg-slate-100 rounded-xl text-sm border border-slate-200">
          <div className="flex items-center gap-2.5 truncate">
            <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
            <span className="truncate font-medium">{file.name}</span>
            <span className="text-xs text-muted-foreground">
              ({(file.size / 1024).toFixed(1)} KB)
            </span>
          </div>
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3.5 rounded-xl">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {warning && !error && (
        <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 p-3.5 rounded-xl">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{warning}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button
          size="lg"
          onClick={handleUploadAndProceed}
          disabled={(!file && !uploaded) || uploading}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
        >
          {uploading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ingesting Résumé...
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              {uploaded && !file ? "Continue with Saved CV" : "Upload & Continue"}
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>

        {onSkip && (
          <Button
            variant="ghost"
            size="lg"
            onClick={onSkip}
            disabled={uploading}
            className="text-xs text-muted-foreground"
          >
            Skip for now
          </Button>
        )}
      </div>

      <div className="text-center pt-2">
        <BackButton fallbackPath="/candidate" label="Return to Dashboard" variant="ghost" className="text-xs" />
      </div>
    </div>
  );
};

export default CvUploadScreen;
