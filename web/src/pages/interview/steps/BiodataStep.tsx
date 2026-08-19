import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sessionsApi } from "@/services/sessions";
import { Loader2, FileCheck2, Upload } from "lucide-react";
import type { CandidateInfo } from "@/types";

export default function BiodataStep({ token, candidateInfo, onContinue }: {
  token: string;
  candidateInfo: CandidateInfo | null;
  onContinue: () => void;
}) {
  const [name, setName] = useState(candidateInfo?.candidate_name ?? "");
  const [phone, setPhone] = useState(candidateInfo?.candidate_phone ?? "");
  const [address, setAddress] = useState(candidateInfo?.candidate_address ?? "");
  const [cv, setCv] = useState<File | null>(null);
  const [cvAlreadyOnFile, setCvAlreadyOnFile] = useState(candidateInfo?.cv_attached ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await sessionsApi.submitBiodata(token, {
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        cv: cv ?? undefined,
      });
      onContinue();
    } catch (e: any) {
      setError(e?.response?.data?.errors?.[0]?.message ?? "Failed to save your details. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-semibold">Your details</h1>
        <p className="text-sm text-muted-foreground">We'll use this to identify your application.</p>
      </div>

      {error && <p className="text-sm text-destructive text-center">{error}</p>}

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="bio-name">Full name *</Label>
          <Input id="bio-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={candidateInfo?.candidate_email ?? ""} disabled />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bio-phone">Phone</Label>
          <Input id="bio-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bio-address">Address</Label>
          <Textarea id="bio-address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bio-cv">CV / Resume</Label>
          <label
            htmlFor="bio-cv"
            className="flex items-center gap-2 border border-dashed rounded-lg px-3 py-3 text-sm text-muted-foreground cursor-pointer hover:border-primary/50"
          >
            {cv ? (
              <><FileCheck2 className="h-4 w-4 text-primary" /> {cv.name}</>
            ) : cvAlreadyOnFile ? (
              <><FileCheck2 className="h-4 w-4 text-primary" /> CV already on file — upload to replace</>
            ) : (
              <><Upload className="h-4 w-4" /> Upload PDF (optional)</>
            )}
          </label>
          <input
            id="bio-cv"
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setCv(f);
              if (f) setCvAlreadyOnFile(false);
            }}
          />
        </div>
      </div>

      <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Continue
      </Button>
    </div>
  );
}
