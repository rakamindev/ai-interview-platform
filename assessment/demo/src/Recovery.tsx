import { CanvasImage, staticFile, useVideoConfig } from 'remotion';
import { Frame, Notes } from './Frame';

export const Recovery = () => {
  const { fps } = useVideoConfig();
  return <Frame chapter="05 · Failure paths" title="A failed refresh does not erase the last report">
    <div style={{ display: 'grid', gridTemplateColumns: '1140px 1fr', gap: 50, height: '100%', alignItems: 'center' }}>
      <div><p style={{ fontSize: 24, fontWeight: 700, color: '#854d0e', marginTop: 0 }}>SIMULATED QUEUE-FAILURE RESPONSE · UI VERIFICATION</p><CanvasImage src={staticFile('simulated-failed-refresh.png')} premountFor={fps} style={{ width: '100%', height: 650, objectFit: 'cover', objectPosition: 'top', border: '1px solid #cbd5df' }} /></div>
      <Notes><p>Queued, generating, complete, failed, and stale states are persisted.</p><p>A failed refresh keeps the prior snapshot and offers an explicit retry. Exports wait until the comparison is current.</p><p>Generation tokens and row locking reject obsolete or duplicate work. A two-minute lease bounds lost-job recovery.</p><p style={{ fontSize: 24, color: '#526473' }}>The screenshot uses a labeled response simulation. Queue failures and rollback are also tested in the backend suite.</p></Notes>
    </div>
  </Frame>;
};
