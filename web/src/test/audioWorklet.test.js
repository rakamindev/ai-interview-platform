import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

function processor() {
  let Processor;
  const frames = [];
  class AudioWorkletProcessor {
    port = { postMessage: (buffer) => frames.push(Array.from(new Int16Array(buffer))) };
  }
  runInNewContext(readFileSync("public/audio-worklet-processor.js", "utf8"), {
    AudioWorkletProcessor, Int16Array,
    registerProcessor: (_name, implementation) => { Processor = implementation; },
  });
  return { instance: new Processor(), frames };
}

describe("actual PCM worklet", () => {
  it("preserves quiet microphone samples instead of replacing them with zeros", () => {
    const { instance, frames } = processor();
    instance.process([[new Float32Array([0.005, -0.005])]]);
    expect(frames[0]).toEqual([163, -163]);
  });
  it("keeps silence flowing so upstream automatic VAD can observe the full pause", () => {
    const { instance, frames } = processor();
    for (let i = 0; i < 200; i++) instance.process([[new Float32Array(128)]]);
    expect(frames).toHaveLength(200);
    expect(frames.every(frame => frame.every(sample => sample === 0))).toBe(true);
  });
});
