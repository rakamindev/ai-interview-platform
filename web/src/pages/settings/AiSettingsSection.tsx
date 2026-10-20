import { useEffect, useState } from "react";
import { organizationService } from "@/services/organization";
import type { OrganizationAiConfig } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function AiSettingsSection() {
  const [config, setConfig] = useState<OrganizationAiConfig | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [liveModel, setLiveModel] = useState("");
  const [proModel, setProModel] = useState("");
  const [voice, setVoice] = useState("Puck");
  const [temperature, setTemperature] = useState("0.2");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    organizationService
      .getAiConfig()
      .then((data) => {
        setConfig(data);
        setLiveModel(data.models.live || "");
        setProModel(data.models.pro || "");
        setVoice(data.voice || "Puck");
        setTemperature(String(data.temperature ?? 0.2));
      })
      .catch((err) => {
        setMessage({ text: err.message || "Failed to load AI settings", type: "error" });
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const payload: {
        gemini_api_key?: string;
        models: { live?: string; pro?: string };
        voice: string;
        temperature: number;
      } = {
        models: { live: liveModel.trim(), pro: proModel.trim() },
        voice,
        temperature: parseFloat(temperature),
      };

      if (apiKeyInput.trim()) {
        payload.gemini_api_key = apiKeyInput.trim();
      }

      const updated = await organizationService.updateAiConfig(payload);
      setConfig(updated);
      setApiKeyInput("");
      setMessage({ text: "AI settings saved successfully.", type: "success" });
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { errors?: Array<{ message: string }> } }; message?: string };
      const errMsg = errObj.response?.data?.errors?.[0]?.message || errObj.message || "Failed to save AI settings";
      setMessage({ text: errMsg, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 space-y-4">
          <p className="text-sm text-muted-foreground">Loading AI configuration...</p>
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Enterprise AI Engine Configuration</CardTitle>
            <CardDescription>
              Configure tenant-specific Gemini credentials, model tiers, and speech profiles.
            </CardDescription>
          </div>
          {config?.gemini_api_key_configured ? (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
              Custom Key Active: {config.masked_gemini_api_key}
            </Badge>
          ) : (
            <Badge variant="outline">System Default Fallback</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="geminiApiKey">Gemini API Key</Label>
            <Input
              id="geminiApiKey"
              type="password"
              placeholder={config?.gemini_api_key_configured ? "Leave blank to keep current key" : "AIzaSy..."}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Used for live interview streaming (Gemini Live) and evaluation report generation (Gemini Pro).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="liveModel">Live Audio Model</Label>
              <Input
                id="liveModel"
                value={liveModel}
                onChange={(e) => setLiveModel(e.target.value)}
                placeholder="gemini-2.0-flash-exp"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="proModel">Evaluation Model</Label>
              <Input
                id="proModel"
                value={proModel}
                onChange={(e) => setProModel(e.target.value)}
                placeholder="gemini-2.0-pro-exp-02-05"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="geminiVoice">Interviewer Voice Profile</Label>
              <select
                id="geminiVoice"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {(config?.allowed_voices || ["Puck", "Charon", "Aoede", "Fenrir", "Kore"]).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="temperature">Sampling Temperature (0.0 – 1.0)</Label>
              <Input
                id="temperature"
                type="number"
                step="0.05"
                min="0.0"
                max="1.0"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
              />
            </div>
          </div>

          {message && (
            <div
              className={`p-3 rounded-md text-sm ${
                message.type === "success" ? "bg-emerald-50 text-emerald-900 border border-emerald-200" : "bg-destructive/15 text-destructive border border-destructive/20"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save AI Settings"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
