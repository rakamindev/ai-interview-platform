import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { ReadinessCheckRecord } from "@/types";

const CHECK_LABELS: Record<string, string> = {
    browser: "browser",
    network: "internet",
    microphone: "microphone",
    audio_output: "audio output",
};

type Tone = "good" | "weak" | "bad";

const TONE_CLASS: Record<Tone, string> = {
    good: "text-green-700",
    weak: "text-amber-700",
    bad: "text-destructive",
};

const TONE_ICON = { good: CheckCircle2, weak: AlertTriangle, bad: XCircle } as const;

const mbps = (v: number | null) => (v === null ? "?" : v < 10 ? v.toFixed(2) : v.toFixed(1));

/** Assessor-facing summary of the candidate's pre-interview device check. */
export function describeReadiness(r: ReadinessCheckRecord): { tone: Tone; label: string; detail: string } {
    const latency = r.latency_ms === null ? "" : ` · ${r.latency_ms} ms`;
    const attempts = r.attempts > 1 ? ` · ${r.attempts} attempts` : "";
    const detail = `↓${mbps(r.download_mbps)} ↑${mbps(r.upload_mbps)} Mbps${latency}${attempts}`;

    if (r.verdict === "fail") {
        const failed = Object.entries(r.checks)
            .filter(([, state]) => state === "failed")
            .map(([name]) => CHECK_LABELS[name] ?? name);
        return { tone: "bad", label: `Blocked at device check${failed.length ? `: ${failed.join(", ")}` : ""}`, detail };
    }
    if (r.verdict === "warn") return { tone: "weak", label: "Weak connection", detail };
    return { tone: "good", label: "Device check passed", detail };
}

export function ReadinessBadge({ readiness }: { readiness?: ReadinessCheckRecord | null }) {
    if (!readiness) return null;
    const { tone, label, detail } = describeReadiness(readiness);
    const Icon = TONE_ICON[tone];
    return (
        <div
            className={`flex flex-wrap items-center gap-x-1.5 text-xs ${TONE_CLASS[tone]}`}
            title={`Checked ${new Date(readiness.checked_at).toLocaleString()}`}
        >
            <Icon className="h-3 w-3 shrink-0" aria-hidden />
            <span className="font-medium">{label}</span>
            <span className="text-muted-foreground">{detail}</span>
        </div>
    );
}
