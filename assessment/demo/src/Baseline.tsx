import { CanvasImage, staticFile, useVideoConfig } from 'remotion';
import { Frame, Notes } from './Frame';

export const Baseline = () => {
  const { fps } = useVideoConfig();
  return <Frame chapter="02 · Observed defect" title="The required level disappeared at the API boundary">
    <div style={{ display: 'grid', gridTemplateColumns: '1170px 1fr', gap: 40, height: '100%', alignItems: 'center' }}>
      <CanvasImage src={staticFile('before-comparison.png')} premountFor={fps} style={{ width: '100%', height: 720, objectFit: 'contain', background: 'white', border: '1px solid #cbd5df' }} />
      <Notes><p>The API supplied <strong>expected_level</strong>. The original table read <strong>required_level</strong>.</p><p>The recruiter could see a gap without seeing its benchmark.</p><p>Missing evidence also needed a separate summary and a clear next step.</p><p style={{ fontSize: 24, color: '#526473' }}>Original frontend, reproduced with synthetic comparison data before the UI change.</p></Notes>
    </div>
  </Frame>;
};
