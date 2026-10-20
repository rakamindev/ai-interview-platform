import { useRef, useState, useCallback } from "react";

// A muted microphone and a quiet room both deliver samples, so the track never
// ends and nothing in the readyState watchdog fires. The worklet reports its
// measured level several times a second instead, and this is the bar the page
// applies to it.
//
// The threshold is deliberately low and the window deliberately long: ordinary
// speech sits far above SILENT_RMS, so this cannot fire while someone is
// talking, and ten seconds of near-silence during the candidate's own turn is
// worth mentioning. The warning clears itself the moment sound returns, so a
// false positive costs a moment of confusion rather than an interview.
const SILENT_RMS = 0.001;
const SILENCE_MS = 10_000;

interface UseAudioCaptureOptions {
  onFrame: (buffer: ArrayBuffer) => void;
  onError?: (error: Error) => void;
}

export function useAudioCapture({ onFrame, onError }: UseAudioCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false);

  // True when the microphone has stopped delivering data ENTIRELY — the track
  // ended, the device changed, or permission was withdrawn. It is not the
  // same as the candidate being quiet: silence still arrives as samples the
  // worklet can measure, so a normal pause never sets this.
  const [micLost, setMicLost] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Mute gate — mic stays hot, we just skip sending frames.
  // Avoids AudioContext.suspend/resume async state issues entirely.
  const mutedRef = useRef(false);
  // Guards every microphone-loss signal: the track listeners, the readyState
  // poll below, and the worklet's port messages. Shutdown flips this false
  // BEFORE the track is stopped, so a late callback cannot tell the candidate
  // "we can't hear you" once the interview has already finished.
  const activeRef = useRef(false);
  // Chromium does not announce a dead track through events alone, so the
  // readyState is polled while capture is live. See the note in start().
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // When sound was last heard, and whether the page is currently showing the
  // "no sound" branch of the warning. Separate from micLost's origin so that
  // sound returning cannot clear a warning caused by a track that actually
  // ended.
  const lastSoundAtRef = useRef(Date.now());
  const silencedRef = useRef(false);
  // Whether the candidate is the one who is supposed to be talking. The
  // transport gate is not a usable substitute: the socket reports 'active' as
  // soon as it connects, the page unmutes on that, and the interviewer's
  // greeting has not even started — so counting silence from the gate alone
  // warned before the candidate had been given a turn.
  const expectingSpeechRef = useRef(false);

  const start = useCallback(async () => {
    if (isCapturing) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;

      await ctx.audioWorklet.addModule("/audio-worklet-processor.js");

      const workletNode = new AudioWorkletNode(ctx, "pcm-processor");
      workletNode.port.onmessage = (e: MessageEvent) => {
        const data = e.data;

        // PCM frames and control messages share this port, so the shape has
        // to be told apart here — an object reaching onFrame would be pushed
        // to the server as though it were audio.
        if (data instanceof ArrayBuffer) {
          if (!mutedRef.current) onFrame(data);
          return;
        }

        // The worklet's periodic measurement. Sound at or above the bar both
        // resets the silence timer and clears a warning that silence caused.
        if (data && data.type === "level") {
          if (data.rms >= SILENT_RMS) {
            lastSoundAtRef.current = Date.now();
            if (silencedRef.current) {
              silencedRef.current = false;
              setMicLost(false);
            }
          }
          return;
        }

        if (data && data.type === "no_input") setMicLost(true);
        else if (data && data.type === "input_restored") setMicLost(false);
      };
      workletNodeRef.current = workletNode;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(workletNode);

      // The worklet only reports an absent input once its threshold passes.
      // A track that announces it is finished or muted should warn at once.
      const track = stream.getAudioTracks()[0];
      if (track) {
        const markLost = () => {
          if (activeRef.current) setMicLost(true);
        };
        const markRestored = () => {
          if (activeRef.current) setMicLost(false);
        };
        track.addEventListener("ended", markLost);
        track.addEventListener("mute", markLost);
        track.addEventListener("unmute", markRestored);

        // Events are not enough on their own, and this is measured rather
        // than assumed. Once a track ends, createMediaStreamSource keeps
        // feeding the worklet SILENCE instead of an empty input — input still
        // looks present — so the worklet's no_input branch never fires, and a
        // stop() this page performed itself raises no 'ended' either. On
        // Chromium 156 nothing warned at all until readyState was read
        // directly, and that read was 'ended' in every observed case.
        //
        // 'ended' is terminal: it can be set but never cleared, so this branch
        // can only ever warn.
        //
        // Silence is the other half, and it is handled here rather than in the
        // track events because a muted microphone fires nothing at all: the
        // track stays 'live' and keeps delivering samples — they are just
        // silent. The worklet reports the measured level; this is where the
        // page decides that too long without sound is worth saying out loud.
        if (watchdogRef.current) clearInterval(watchdogRef.current);
        watchdogRef.current = setInterval(() => {
          if (!activeRef.current) return;

          if (track.readyState === "ended") {
            setMicLost(true);
            return;
          }

          // Only while the candidate is the one expected to speak, and only
          // while the gate is open. A deliberate mute must not be nagged
          // about, and the interviewer's own turn must never count.
          if (
            expectingSpeechRef.current &&
            !mutedRef.current &&
            Date.now() - lastSoundAtRef.current > SILENCE_MS
          ) {
            silencedRef.current = true;
            setMicLost(true);
          }
        }, 1000);
      }

      // Reset the silence clock to the moment capture began, so a hook that was
      // mounted long before start() cannot warn on its first tick.
      lastSoundAtRef.current = Date.now();
      silencedRef.current = false;
      activeRef.current = true;
      setMicLost(false);
      setIsCapturing(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("[AudioCapture] Failed to start:", error.message);
      onError?.(error);
    }
  }, [isCapturing, onFrame, onError]);

  const mute = useCallback(() => {
    mutedRef.current = true;
  }, []);

  // Called when the interviewer hands the turn over (and back). Opening the
  // window restarts the clock, so a long AI turn is never counted against the
  // candidate.
  const setExpectingSpeech = useCallback((on: boolean) => {
    expectingSpeechRef.current = on;
    if (on) {
      lastSoundAtRef.current = Date.now();
    } else if (silencedRef.current) {
      // The turn is over, so silence is no longer the candidate's problem.
      // Only a warning this detector raised is cleared here.
      silencedRef.current = false;
      setMicLost(false);
    }
  }, []);

  const unmute = useCallback(() => {
    mutedRef.current = false;
    // The gate was closed while the AI spoke, so the silence clock is stale by
    // however long that turn took. Restart it, or the candidate is warned the
    // instant their turn begins.
    lastSoundAtRef.current = Date.now();
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mutedRef.current = false;
    silencedRef.current = false;
    expectingSpeechRef.current = false;
    setMicLost(false);
    setIsCapturing(false);
  }, []);

  return { start, stop, mute, unmute, setExpectingSpeech, isCapturing, micLost };
}
