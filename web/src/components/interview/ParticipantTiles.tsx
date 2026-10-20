import { useEffect, useState } from "react";
import { Bot, Mic, MicOff, Volume2 } from "lucide-react";
import type { InterviewSpeaker } from "@/types";

interface ParticipantTilesProps {
  candidateName?: string;
  speaker: InterviewSpeaker;
  micMuted: boolean;
  getAiVolume?: () => number;
  getCandidateVolume?: () => number;
}

const VOLUME_THRESHOLD = 0.15; // 15% threshold

const isVolumeAboveThreshold = (vol?: number): boolean => {
  if (!vol || typeof vol !== "number") return false;
  // Support both normalized 0..1 scale (0.15) and percentage scale 0..100 (15)
  return vol > 1 ? vol > 15 : vol > VOLUME_THRESHOLD;
};

export default function ParticipantTiles({
  candidateName,
  speaker,
  micMuted,
  getAiVolume,
  getCandidateVolume,
}: ParticipantTilesProps) {
  const isAiTalking = speaker === "ai";
  const isCandidateTalking = speaker === "candidate";

  const [aiIsSpeaking, setAiIsSpeaking] = useState(false);
  const [candidateIsSpeaking, setCandidateIsSpeaking] = useState(false);

  // Sound volume tracking and steady conversational voice activity loop
  useEffect(() => {
    let animId: number;
    let aiSilenceTimeout: ReturnType<typeof setTimeout> | null = null;
    let candidateSilenceTimeout: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      // 1. AI Volume tracking — static active state if input > 15% or turn active
      const aiVol = getAiVolume ? getAiVolume() : 0;
      const aiSpeakingNow = isAiTalking || isVolumeAboveThreshold(aiVol);

      if (aiSpeakingNow) {
        if (aiSilenceTimeout) {
          clearTimeout(aiSilenceTimeout);
          aiSilenceTimeout = null;
        }
        setAiIsSpeaking(true);
      } else if (aiIsSpeaking && !aiSilenceTimeout) {
        // Hold active state for 400ms across conversational pauses to prevent blinking
        aiSilenceTimeout = setTimeout(() => {
          setAiIsSpeaking(false);
          aiSilenceTimeout = null;
        }, 400);
      }

      // 2. Candidate Volume tracking — static active state if input > 15% or turn active
      const candidateVol = getCandidateVolume ? getCandidateVolume() : 0;
      const candidateSpeakingNow = !micMuted && (isCandidateTalking || isVolumeAboveThreshold(candidateVol));

      if (candidateSpeakingNow) {
        if (candidateSilenceTimeout) {
          clearTimeout(candidateSilenceTimeout);
          candidateSilenceTimeout = null;
        }
        setCandidateIsSpeaking(true);
      } else if (micMuted) {
        setCandidateIsSpeaking(false);
      } else if (candidateIsSpeaking && !candidateSilenceTimeout) {
        // Hold active state for 400ms across conversational pauses to prevent blinking
        candidateSilenceTimeout = setTimeout(() => {
          setCandidateIsSpeaking(false);
          candidateSilenceTimeout = null;
        }, 400);
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
      if (aiSilenceTimeout) clearTimeout(aiSilenceTimeout);
      if (candidateSilenceTimeout) clearTimeout(candidateSilenceTimeout);
    };
  }, [isAiTalking, isCandidateTalking, micMuted, getAiVolume, getCandidateVolume, aiIsSpeaking, candidateIsSpeaking]);

  const getInitials = (name?: string) => {
    if (!name?.trim()) return "K";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Static styling for active speaking states (no blinking / volume jitter)
  const isAiActive = isAiTalking || aiIsSpeaking || isVolumeAboveThreshold(getAiVolume?.());
  const aiBorderWidth = isAiActive ? "3px" : "1px";
  const aiBorderColor = isAiActive ? "#3b82f6" : "#e2e8f0";
  const aiBoxShadow = isAiActive ? "0 0 16px rgba(59, 130, 246, 0.35)" : "none";

  const isCandidateActive =
    !micMuted && (isCandidateTalking || candidateIsSpeaking || isVolumeAboveThreshold(getCandidateVolume?.()));
  const candidateBorderWidth = isCandidateActive ? "3px" : "1px";
  const candidateBorderColor = isCandidateActive ? "#3b82f6" : "#e2e8f0";
  const candidateBoxShadow = isCandidateActive ? "0 0 16px rgba(59, 130, 246, 0.35)" : "none";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full max-w-6xl mx-auto p-4 items-center">
      {/* ── AI Interviewer Tile ── */}
      <div
        data-testid="ai-participant-tile"
        style={{
          borderStyle: "solid",
          borderWidth: aiBorderWidth,
          borderColor: aiBorderColor,
          boxShadow: aiBoxShadow,
          transform: "scale(1)",
        }}
        className="relative flex flex-col items-center justify-center rounded-2xl w-full h-64 sm:h-80 md:h-[400px] bg-white text-slate-800 shadow-sm transition-all duration-150 overflow-hidden"
      >
        {/* Top-Right Voice Activity / Status Icon */}
        <div className="absolute top-4 right-4 z-10">
          {isAiActive ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold shadow-sm">
              <Volume2 className="h-3.5 w-3.5 text-blue-600" />
              <span>Speaking</span>
              <div className="flex items-end gap-0.5 ml-1 h-3">
                <span className="w-0.5 h-2 bg-blue-600 rounded-full" />
                <span className="w-0.5 h-3 bg-blue-600 rounded-full" />
                <span className="w-0.5 h-2 bg-blue-600 rounded-full" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Ready</span>
            </div>
          )}
        </div>

        {/* Center Avatar — Static, Clean, High Contrast */}
        <div className="relative flex items-center justify-center">
          <div
            className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center shadow-sm transition-all duration-200 ${
              isAiActive
                ? "bg-gradient-to-tr from-blue-600 to-indigo-600 ring-4 ring-blue-100 text-white shadow-md"
                : "bg-slate-50 border-2 border-slate-200 text-slate-500"
            }`}
          >
            <Bot className="w-12 h-12" />
          </div>
        </div>

        {/* Bottom Left Participant Name Label */}
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-lg bg-slate-50/90 backdrop-blur border border-slate-200 text-xs font-medium text-slate-700 shadow-sm tracking-wide">
            AI Interviewer (Rakamin)
          </span>
        </div>
      </div>

      {/* ── Candidate (User) Tile ── */}
      <div
        data-testid="candidate-participant-tile"
        style={{
          borderStyle: "solid",
          borderWidth: candidateBorderWidth,
          borderColor: candidateBorderColor,
          boxShadow: candidateBoxShadow,
          transform: "scale(1)",
        }}
        className="relative flex flex-col items-center justify-center rounded-2xl w-full h-64 sm:h-80 md:h-[400px] bg-white text-slate-800 shadow-sm transition-all duration-150 overflow-hidden"
      >
        {/* Top-Right Mic Status */}
        <div className="absolute top-4 right-4 z-10">
          {micMuted ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-medium" title="Microphone muted">
              <MicOff className="h-3.5 w-3.5" />
              <span>Muted</span>
            </div>
          ) : (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                isCandidateActive
                  ? "bg-blue-50 border border-blue-200 text-blue-700 font-semibold shadow-sm"
                  : "bg-slate-100 border border-slate-200 text-slate-600"
              }`}
              title={isCandidateActive ? "Microphone active (speaking)" : "Microphone active"}
            >
              <Mic className={`h-3.5 w-3.5 ${isCandidateActive ? "text-blue-600" : "text-slate-500"}`} />
              <span>{isCandidateActive ? "Speaking" : "On"}</span>
              {isCandidateActive && (
                <div className="flex items-end gap-0.5 ml-0.5 h-3">
                  <span className="w-0.5 h-2 bg-blue-600 rounded-full" />
                  <span className="w-0.5 h-3 bg-blue-600 rounded-full" />
                  <span className="w-0.5 h-2 bg-blue-600 rounded-full" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center Avatar — Static, Clean, High Contrast */}
        <div className="relative flex items-center justify-center">
          <div
            className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center text-2xl font-bold shadow-sm transition-all duration-200 ${
              isCandidateActive
                ? "bg-gradient-to-tr from-purple-600 to-indigo-600 ring-4 ring-purple-100 text-white shadow-md"
                : "bg-purple-50 border-2 border-purple-200 text-purple-700"
            }`}
          >
            {getInitials(candidateName)}
          </div>
        </div>

        {/* Bottom Left Participant Name Label */}
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-lg bg-slate-50/90 backdrop-blur border border-slate-200 text-xs font-medium text-slate-700 shadow-sm tracking-wide">
            {candidateName || "Candidate"} (You)
          </span>
        </div>
      </div>
    </div>
  );
}
