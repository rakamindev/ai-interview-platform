import { Frame, Notes } from './Frame';

export const Closing = () => <Frame chapter="07 · Trade-offs" title="A focused change that can be explained and maintained">
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 90, paddingTop: 36 }}>
    <div><h2 style={{ fontSize: 50, color: '#0f6e70', marginTop: 0 }}>What ships</h2><Notes><p>A deterministic fit/gap comparison using the existing Rails, Sidekiq, PostgreSQL, and React stack.</p><p>Tenant ownership checks, preserved human reviews, explicit missing evidence, source fingerprints, and consistent PDF/JSON exports.</p><p>Reproducible setup, automated checks, fault proof, screenshots, and a report linked to the pull request.</p></Notes></div>
    <div><h2 style={{ fontSize: 50, marginTop: 0 }}>Honest limits</h2><Notes><p>The fit/gap path needs no Gemini call. The original live microphone interview was not verified against the live Gemini service.</p><p>A transactional outbox, whole-product privacy audit, retention workflows, and broader interview reliability remain separate work.</p><p>Human review remains essential. No time-saving, fairness, or hiring-accuracy improvement is claimed without measurement.</p></Notes></div>
  </div>
</Frame>;
