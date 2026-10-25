import { Video } from '@remotion/media';
import { staticFile, useVideoConfig } from 'remotion';
import { Frame, Notes } from './Frame';

export const Workflow = () => {
  const { fps } = useVideoConfig();
  return <Frame chapter="03 · Real browser flow" title="From assessment to evidence and export">
    <div style={{ display: 'grid', gridTemplateColumns: '1140px 1fr', gap: 44, height: '100%', alignItems: 'center' }}>
      <Video src={staticFile('workflow.webm')} playbackRate={0.65} muted objectFit="contain" premountFor={fps} style={{ width: 1140, height: 712, border: '1px solid #cbd5df', background: 'white' }} />
      <Notes><p>Sign in and open the completed synthetic interview.</p><p>Choose the vacancy and inspect the comparison.</p><p>Read evidence, filter follow-ups, refresh, download, and open the transcript.</p><p style={{ fontSize: 24, color: '#526473' }}>Actual browser recording against the local Rails API and Sidekiq worker. Slowed for readability.</p></Notes>
    </div>
  </Frame>;
};
