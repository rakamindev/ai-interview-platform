import { CanvasImage, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Frame, Notes } from './Frame';

export const Evidence = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig();
  return <Frame chapter="04 · Review quality" title="Keep the benchmark and rating source visible">
    <div style={{ display: 'grid', gridTemplateColumns: '1160px 1fr', gap: 50, height: '100%', alignItems: 'center' }}>
      <div style={{ height: 730, overflow: 'hidden', border: '1px solid #cbd5df', background: 'white' }}><CanvasImage src={staticFile('after-desktop.png')} premountFor={fps} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: interpolate(frame, [3 * fps, 25 * fps], ['50% 0%', '50% 100%'], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }} /></div>
      <Notes><p><strong>3 of 4</strong> requirements have usable ratings. Communication remains unassessed.</p><p>RESTful API Design requires <strong>L4</strong>. A human reviewed the original AI <strong>L2</strong> and assigned <strong>L3</strong>: a one-level gap.</p><p>Quotes and assessor notes stay next to the comparison. No culture-fit or automatic hiring verdict is inferred.</p></Notes>
    </div>
  </Frame>;
};
