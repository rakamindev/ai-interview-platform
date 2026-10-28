import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Volume2, Check, Sliders, Play, Square, Building2 } from "lucide-react";

interface VoiceOption {
  label: string;
  desc: string;
  pitch: number;
  rate: number;
  gender: "female" | "male";
  text: string;
}

const VOICE_OPTIONS: Record<string, VoiceOption> = {
  female: {
    label: "Female Voice",
    desc: "Natural & clear feminine tone",
    pitch: 1.25,
    rate: 1.0,
    gender: "female",
    text: "Hello, I'm your AI interviewer from Rakamin. I'm ready to guide your interview session with structured, professional questions.",
  },
  male: {
    label: "Male Voice",
    desc: "Calm & professional masculine tone",
    pitch: 0.85,
    rate: 0.98,
    gender: "male",
    text: "Hello, I'm your AI interviewer from Rakamin. I'm ready to guide your interview session with structured, professional questions.",
  },
};

export default function SettingsPage() {
  const [voice, setVoice] = useState<"female" | "male">(() => {
    const saved = localStorage.getItem("rakamin_ai_voice");
    if (saved === "male" || saved === "Puck" || saved === "Charon" || saved === "Fenrir") {
      return "male";
    }
    return "female";
  });

  const [temperature, setTemperature] = useState(() => {
    const saved = localStorage.getItem("rakamin_ai_temp");
    return saved ? parseFloat(saved) : 0.7;
  });

  const [companyCulture, setCompanyCulture] = useState(() => {
    return (
      localStorage.getItem("rakamin_company_culture") ||
      "Extreme ownership, customer-centric problem solving, rapid iterative delivery, continuous learning, and direct feedback culture."
    );
  });

  const [saved, setSaved] = useState(false);
  const [playingVoice, setPlayingVoice] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Prime Web Speech voices
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) {
        setAvailableVoices(v);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSave = () => {
    localStorage.setItem("rakamin_ai_voice", voice);
    localStorage.setItem("rakamin_ai_temp", String(temperature));
    localStorage.setItem("rakamin_company_culture", companyCulture);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // Play sample voice with true gender selection (Point 49)
  const playSample = () => {
    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech preview is not supported in this browser.");
      return;
    }

    if (playingVoice) {
      window.speechSynthesis.cancel();
      setPlayingVoice(false);
      return;
    }

    window.speechSynthesis.cancel();
    const config = VOICE_OPTIONS[voice] || VOICE_OPTIONS.female;
    const utterance = new SpeechSynthesisUtterance(config.text);
    utterance.lang = "en-US";
    utterance.pitch = config.pitch;
    utterance.rate = config.rate;

    const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
    const enVoices = voices.filter((v) => v.lang.startsWith("en"));

    if (config.gender === "female") {
      const femaleVoice = enVoices.find((v) => {
        const n = v.name.toLowerCase();
        return (
          n.includes("female") ||
          n.includes("zira") ||
          n.includes("jenny") ||
          n.includes("aria") ||
          n.includes("samantha") ||
          n.includes("victoria") ||
          n.includes("karen") ||
          n.includes("susan") ||
          n.includes("catherine") ||
          n.includes("linda") ||
          n.includes("eva")
        );
      });
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      } else if (enVoices.length > 1) {
        utterance.voice = enVoices[1];
      }
    } else {
      const maleVoice = enVoices.find((v) => {
        const n = v.name.toLowerCase();
        return (
          n.includes("male") ||
          n.includes("david") ||
          n.includes("guy") ||
          n.includes("george") ||
          n.includes("mark") ||
          n.includes("richard") ||
          n.includes("james")
        );
      });
      if (maleVoice) {
        utterance.voice = maleVoice;
      } else if (enVoices.length > 0) {
        utterance.voice = enVoices[0];
      }
    }

    utterance.onstart = () => setPlayingVoice(true);
    utterance.onend = () => setPlayingVoice(false);
    utterance.onerror = () => setPlayingVoice(false);

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure AI interviewer parameters, voice gender, and system preferences.
        </p>
      </div>

      {/* AI Voice Selection — 2 Clean Options: Female or Male (Point 49) */}
      <Card className="border border-slate-200/80 shadow-2xs bg-white">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">AI Voice Gender</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Select the voice model used by Rakamin AI during candidate voice interview sessions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-voice" className="text-sm font-semibold text-slate-800">
              Interviewer Voice
            </Label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <Select
                value={voice}
                onValueChange={(v) => {
                  setVoice(v as "female" | "male");
                  if (playingVoice) window.speechSynthesis.cancel();
                  setPlayingVoice(false);
                }}
              >
                <SelectTrigger id="ai-voice" className="w-full sm:w-56 bg-white">
                  <SelectValue placeholder="Select voice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                </SelectContent>
              </Select>

              {/* Play Sample Voice Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={`text-xs ${
                  playingVoice
                    ? "border-rose-300 text-rose-600 hover:bg-rose-50"
                    : "border-primary/40 text-primary hover:bg-primary/5"
                }`}
                onClick={playSample}
              >
                {playingVoice ? (
                  <>
                    <Square className="h-3.5 w-3.5 mr-1.5 fill-current" />
                    Stop Sample
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                    Test AI Voice Sample
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground pt-1">
              Multimodal voice stream synthesized in real-time during live candidate interviews.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* AI Temperature */}
      <Card className="border border-slate-200/80 shadow-2xs bg-white">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base font-semibold">AI Interview Temperature</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Controls the balance between strict anchor probing vs. conversational adaptability.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="temperature" className="text-sm font-semibold text-slate-800">
                Temperature: <span className="font-bold text-primary">{temperature.toFixed(2)}</span>
              </Label>
              <span className="text-xs text-muted-foreground">
                {temperature < 0.4
                  ? "Strict Anchor Probing"
                  : temperature > 0.8
                  ? "Highly Adaptive"
                  : "Balanced (Recommended)"}
              </span>
            </div>
            <input
              id="temperature"
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>0.1 (Strict)</span>
              <span>0.7 (Standard Balanced)</span>
              <span>1.0 (Exploratory)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organization Culture & Working Standards */}
      <Card className="border border-slate-200/80 shadow-2xs bg-white">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">Organization Culture & Core Values</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Define your company's core values, workplace dynamics, and behavioral standards. The AI interviewer uses this as the baseline system calibration across all vacancy roles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company-culture" className="text-sm font-semibold text-slate-800">
              Core Cultural Pillars & Values
            </Label>
            <Textarea
              id="company-culture"
              rows={4}
              placeholder="e.g. Extreme ownership, customer obsession, high-velocity iteration, user empathy, data-informed decisions..."
              value={companyCulture}
              onChange={(e) => setCompanyCulture(e.target.value)}
              className="bg-white text-xs leading-relaxed"
            />
            <p className="text-[11px] text-muted-foreground">
              Inherited automatically by all vacancy interviews. Individual vacancies can optionally specify team-specific squad dynamics.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-2">
        {saved ? (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
            <Check className="h-4 w-4" /> Preferences saved successfully
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Changes will apply to future sessions.</span>
        )}
        <Button onClick={handleSave} className="min-w-28">
          Save Settings
        </Button>
      </div>
    </div>
  );
}
