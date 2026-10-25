import { CanvasImage, staticFile, useVideoConfig } from 'remotion';
import { Frame } from './Frame';

export const Opening = () => {
  const { fps } = useVideoConfig();
  return <Frame chapter="01 · The problem" title="A comparison a recruiter can inspect">
    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.7fr', gap: 90, height: '100%', alignItems: 'center' }}>
      <div><h2 style={{ fontSize: 86, lineHeight: 1.08, margin: '0 0 38px', color: '#0f6e70' }}>Missing evidence<br />is not a skill gap.</h2>
        <p style={{ fontSize: 35, lineHeight: 1.45 }}>The selected improvement connects role requirements, observed ratings, evidence, and human review across Rails and React.</p>
        <p style={{ fontSize: 29, color: '#526473', lineHeight: 1.5 }}>This walkthrough covers the original defect, the real review flow, recovery states, and verification. All candidate data shown is synthetic.</p>
      </div>
      <div style={{ height: 660, overflow: 'hidden', border: '1px solid #cbd5df', borderRadius: 8, background: 'white' }}><CanvasImage src={staticFile('after-mobile.png')} premountFor={fps} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} /></div>
    </div>
  </Frame>;
};
