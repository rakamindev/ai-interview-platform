import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

export const Frame: React.FC<{ title: string; chapter: string; children: React.ReactNode }> = ({ title, chapter, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return <AbsoluteFill style={{ background: '#f7fafb', color: '#172b3a', fontFamily: 'Arial, sans-serif', padding: '68px 96px' }}>
    <style>{'.demo-notes > p { margin: 0; }'}</style>
    <div style={{ color: '#0f6e70', fontSize: 25, fontWeight: 700, marginBottom: 20 }}>{chapter} / Rakamin case study</div>
    <h1 style={{ fontSize: 58, lineHeight: 1.1, margin: '0 0 34px', letterSpacing: -1 }}>{title}</h1>
    <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    <div style={{ marginTop: 22, fontSize: 22, color: '#526473', display: 'flex', justifyContent: 'space-between' }}><span>Dixon Frederick · Synthetic fixtures · AI-assisted implementation</span><span>Captioned walkthrough</span></div>
    <div style={{ position: 'absolute', bottom: 0, left: 0, height: 5, width: `${Math.min(100, 100 * frame / durationInFrames)}%`, background: '#0f766e' }} />
  </AbsoluteFill>;
};

export const Notes: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="demo-notes" style={{ fontSize: 30, lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: 26 }}>{children}</div>;
