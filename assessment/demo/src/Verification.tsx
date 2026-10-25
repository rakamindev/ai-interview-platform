import { Frame, Notes } from './Frame';

export const Verification = () => <Frame chapter="06 · Proof" title="Verification covers more than the successful path">
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 100, paddingTop: 30 }}>
    <div style={{ borderLeft: '6px solid #0f766e', paddingLeft: 36 }}><h2 style={{ fontSize: 50, marginTop: 0 }}>Recorded local results</h2><Notes><p><strong>61 backend examples</strong>, including all 25 level pairs, authorization, malformed inputs, duplicate delivery, provider errors, and partial-write rollback.</p><p><strong>11 frontend tests</strong>, plus <strong>4 browser regression tests</strong> and the recorded workflow.</p><p>Migration down/up preserves existing report data. The mobile review passes the automated accessibility scan.</p></Notes></div>
    <div><h2 style={{ fontSize: 50, marginTop: 0 }}>Tests that detect a real fault</h2><Notes><p>On a scratch branch, subtraction was deliberately changed to addition.</p><p><strong>28 of 35 comparison examples failed.</strong> The change was committed and reverted with visible history.</p><p>AI verification also caught an unsafe test-runner version through dependency auditing, then replaced it with a patched compatible release.</p></Notes></div>
  </div>
</Frame>;
