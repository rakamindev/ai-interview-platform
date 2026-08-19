import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, Loader2 } from "lucide-react";

interface UploadDropzoneProps {
  onUpload: (files: File[], onProgress: (percent: number) => void) => Promise<void>;
}

export default function UploadDropzone({ onUpload }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;

      setError(null);
      setUploading(true);
      setProgress(0);
      try {
        await onUpload(Array.from(fileList), setProgress);
      } catch (e: any) {
        setError(e?.response?.data?.errors?.[0]?.message ?? "Upload failed. Please try again.");
      }

      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    },
    [onUpload]
  );

  return (
    <div className="space-y-2">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        {uploading ? (
          <div className="space-y-3 max-w-xs mx-auto">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Uploading…</p>
            <Progress value={progress} indicatorClassName="bg-primary" />
          </div>
        ) : (
          <>
            <UploadCloud className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">Drag and drop CVs here</p>
            <p className="text-xs text-muted-foreground mt-1 mb-3">
              PDF or DOCX, multiple files supported
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              Browse files
            </Button>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
