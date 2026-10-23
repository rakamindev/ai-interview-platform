# Interview Flow Revamp (Stage 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Interview and Live Audio/Transcript Flow into a resilient, beautifully crafted, and rigorously tested experience with robust session validation, idempotent termination, UU PDP privacy compliance, live waveform visuals, and comprehensive automated test suites.

**Architecture:** A dual-service enhancement covering Rails API session lifecycle hardening (with RSpec request/service specs) and React frontend Interview HUD revitalization (with live audio waveform, Cult UI thought state indicator, and graceful termination dialogs).

**Tech Stack:** Ruby on Rails 7, PostgreSQL, Sidekiq, RSpec, React 18, TypeScript, Tailwind CSS, Lucide React, Radix UI, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-18-interview-flow-revamp-design.md`

## Global Constraints
- Target branch is `feature/monozukuri-revamp`.
- All changes must adhere to zero sensitive personal data logging (UU PDP compliance).
- Every backend endpoint and service change must have an accompanying RSpec test that fails before passing (TDD).
- UI components must support dark mode and responsive layouts across desktop and mobile.

---

### Task 1: RSpec Testing Harness & Session Request Specs

**Files:**
- Create: `api/spec/spec_helper.rb`
- Create: `api/spec/rails_helper.rb`
- Create: `api/spec/requests/api/v1/sessions_spec.rb`
- Modify: `api/app/controllers/api/v1/sessions_controller.rb:21-44`

**Interfaces:**
- Consumes: `Assessment`, `AssessmentSkill`, `Session`, `User`
- Produces: `POST /api/v1/assessments/:assessment_id/sessions` returning `422` when assessment has 0 skills and `201` when valid.

- [ ] **Step 1: Write RSpec setup and failing session creation request spec**

```ruby
# api/spec/requests/api/v1/sessions_spec.rb
require 'rails_helper'

RSpec.describe "Api::V1::Sessions", type: :request do
  let!(:tenant_id) { 1 }
  let!(:assessment) { Assessment.create!(name: "Software Engineer", tenant_id: tenant_id, created_by: 1, time_limit_min: 30) }
  let(:headers) do
    token = Auth::JwtService.encode({ user_id: 1, role: 'assessor', tenant_id: tenant_id })
    { 'Authorization' => "Bearer #{token}", 'Content-Type' => 'application/json' }
  end

  describe "POST /api/v1/assessments/:assessment_id/sessions" do
    context "when assessment has no skills configured" do
      it "returns 422 with a descriptive error message" do
        post "/api/v1/assessments/#{assessment.id}/sessions", params: { session: { candidate_name: "Alice" } }.to_json, headers: headers

        expect(response).to have_http_status(:unprocessable_entity)
        json = JSON.parse(response.body)
        expect(json["error"]).to eq("Assessment must have at least one configured skill before creating a session.")
      end
    end

    context "when assessment has skills configured" do
      before do
        assessment.assessment_skills.create!(
          skill_label: "Ruby on Rails",
          l1_anchor: "Basic", l2_anchor: "Intermediate", l3_anchor: "Proficient", l4_anchor: "Advanced", l5_anchor: "Expert"
        )
      end

      it "creates the session successfully" do
        post "/api/v1/assessments/#{assessment.id}/sessions", params: { session: { candidate_name: "Alice" } }.to_json, headers: headers

        expect(response).to have_http_status(:created)
        json = JSON.parse(response.body)
        expect(json["session"]["candidate_name"]).to eq("Alice")
        expect(json["invite_url"]).to be_present
      end
    end
  end
end
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && bundle exec rspec spec/requests/api/v1/sessions_spec.rb`
Expected: FAIL (returns 201 instead of 422 on empty skills).

- [ ] **Step 3: Implement validation in `SessionsController#create`**

```ruby
# api/app/controllers/api/v1/sessions_controller.rb
def create
  assessment = Assessment.find(params[:assessment_id])

  unless assessment.assessment_skills.exists?
    return json_error("Assessment must have at least one configured skill before creating a session.", :unprocessable_entity)
  end

  session = assessment.sessions.new(
    candidate_id:   params.dig(:session, :candidate_id),
    candidate_name: params.dig(:session, :candidate_name).presence,
    tenant_id:      current_tenant_id
  )

  if session.save
    json_response(
      {
        session:    session_json(session),
        invite_url: session.invite_url
      },
      :created
    )
  else
    json_error(session.errors.full_messages.first, :unprocessable_entity)
  end
rescue ActiveRecord::RecordNotFound
  json_error("Assessment not found", :not_found)
end
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api && bundle exec rspec spec/requests/api/v1/sessions_spec.rb`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/spec api/app/controllers/api/v1/sessions_controller.rb
git commit -m "feat(api): add assessment skill requirement guard for session creation and RSpec test"
```

---

### Task 2: Session Termination Idempotency & UU PDP Parameter Sanitization

**Files:**
- Create: `api/spec/services/sessions/end_handler_spec.rb`
- Modify: `api/app/services/sessions/end_handler.rb`
- Modify: `api/config/initializers/filter_parameter_logging.rb`

**Interfaces:**
- Consumes: `Session`, `PortfolioGeneratorWorker`
- Produces: `Sessions::EndHandler#call(reason:)` returning safely and enqueueing worker exactly once.

- [ ] **Step 1: Write the failing EndHandler service spec**

```ruby
# api/spec/services/sessions/end_handler_spec.rb
require 'rails_helper'

RSpec.describe Sessions::EndHandler do
  let!(:tenant_id) { 1 }
  let!(:assessment) do
    a = Assessment.create!(name: "Backend Engineer", tenant_id: tenant_id, created_by: 1, time_limit_min: 30)
    a.assessment_skills.create!(
      skill_label: "PostgreSQL",
      l1_anchor: "L1", l2_anchor: "L2", l3_anchor: "L3", l4_anchor: "L4", l5_anchor: "L5"
    )
    a
  end
  let!(:session) do
    Session.create!(
      assessment: assessment,
      tenant_id: tenant_id,
      started_at: 10.minutes.ago,
      status: 'active'
    )
  end

  before do
    allow(PortfolioGeneratorWorker).to receive(:perform_async)
  end

  it "ends active session and enqueues portfolio generation exactly once" do
    handler = described_end_handler = described_class.new(session)
    result = handler.call(reason: 'manual_assessor')

    expect(result.status).to eq('ended')
    expect(result.ended_at).to be_present
    expect(result.duration_seconds).to be >= 590
    expect(PortfolioGeneratorWorker).to have_received(:perform_async).with(session.id).once

    # Repeated call should be idempotent and NOT enqueue worker again
    handler.call(reason: 'manual_assessor')
    expect(PortfolioGeneratorWorker).to have_received(:perform_async).with(session.id).once
  end
end
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && bundle exec rspec spec/services/sessions/end_handler_spec.rb`

- [ ] **Step 3: Implement database transaction and lock guard in `EndHandler`**

```ruby
# api/app/services/sessions/end_handler.rb
def call(reason: 'manual_assessor')
  should_enqueue = false

  ActiveRecord::Base.transaction do
    @session.lock!

    if @session.ended?
      manual = %w[manual_candidate manual_assessor]
      if manual.include?(reason.to_s) && @session.end_reason == 'error'
        @session.update_column(:end_reason, reason.to_s)
      end
      return @session
    end

    valid_reason = VALID_REASONS.include?(reason.to_s) ? reason.to_s : 'manual_assessor'
    duration = @session.started_at ? (Time.current - @session.started_at).to_i : nil

    @session.update!(
      status:           'ended',
      end_reason:       valid_reason,
      ended_at:         Time.current,
      duration_seconds: duration
    )

    create_portfolio
    should_enqueue = true
  end

  enqueue_portfolio_generation if should_enqueue
  publish_status_update
  Rails.logger.info("[N9/EndHandler] Session #{@session.id} ended cleanly")

  @session
end
```

- [ ] **Step 4: Update PII Parameter Filtering for UU PDP**

```ruby
# api/config/initializers/filter_parameter_logging.rb
Rails.application.config.filter_parameters += [
  :passw, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn,
  :candidate_name, :email, :phone, :nik, :audio_data
]
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd api && bundle exec rspec`
Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add api/app/services/sessions/end_handler.rb api/config/initializers/filter_parameter_logging.rb api/spec/services/sessions/end_handler_spec.rb
git commit -m "feat(api): ensure idempotent session termination with transaction lock and UU PDP log sanitization"
```

---

### Task 3: Interactive Live Audio Waveform & Cult UI AI Thought Indicator

**Files:**
- Create: `web/src/components/interview/AudioWaveformVisualizer.tsx`
- Create: `web/src/components/interview/AIThoughtIndicator.tsx`
- Create: `web/src/components/interview/EndSessionModal.tsx`

**Interfaces:**
- Consumes: `isListening: boolean`, `isSpeaking: boolean`, `isThinking: boolean`, `audioLevel: number`
- Produces: Visual components with high-fidelity animated SVG waves, pulsing radial status glows, and modal confirm dialog.

- [ ] **Step 1: Create `AudioWaveformVisualizer.tsx`**

```tsx
// web/src/components/interview/AudioWaveformVisualizer.tsx
import React, { useMemo } from 'react';

interface AudioWaveformVisualizerProps {
  isActive: boolean;
  isAiSpeaking: boolean;
  audioLevel?: number; // 0 to 1
}

export const AudioWaveformVisualizer: React.FC<AudioWaveformVisualizerProps> = ({
  isActive,
  isAiSpeaking,
  audioLevel = 0.5,
}) => {
  const bars = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  return (
    <div className="flex items-center justify-center gap-1 h-20 px-4 py-2 bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-800 shadow-inner">
      {bars.map((bar) => {
        const height = isActive
          ? Math.max(12, Math.sin(bar * 0.4 + (isAiSpeaking ? Date.now() * 0.005 : 0)) * 40 * audioLevel + 20)
          : 6;

        return (
          <div
            key={bar}
            className={`w-1.5 rounded-full transition-all duration-75 ${
              isAiSpeaking
                ? 'bg-gradient-to-t from-blue-500 to-cyan-400 shadow-sm shadow-cyan-500/50'
                : isActive
                ? 'bg-gradient-to-t from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/50'
                : 'bg-slate-700'
            }`}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
};

export default AudioWaveformVisualizer;
```

- [ ] **Step 2: Create `AIThoughtIndicator.tsx`**

```tsx
// web/src/components/interview/AIThoughtIndicator.tsx
import React from 'react';
import { Sparkles, Mic, Volume2 } from 'lucide-react';

interface AIThoughtIndicatorProps {
  status: 'listening' | 'thinking' | 'speaking' | 'idle';
}

export const AIThoughtIndicator: React.FC<AIThoughtIndicatorProps> = ({ status }) => {
  const config = {
    listening: {
      label: 'Mendengarkan Kandidat...',
      color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      icon: <Mic className="w-4 h-4 animate-pulse text-emerald-400" />
    },
    thinking: {
      label: 'AI Sedang Menganalisis...',
      color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
      icon: <Sparkles className="w-4 h-4 animate-spin text-amber-400" />
    },
    speaking: {
      label: 'AI Sedang Berbicara...',
      color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
      icon: <Volume2 className="w-4 h-4 animate-bounce text-cyan-400" />
    },
    idle: {
      label: 'Sesi Siap',
      color: 'text-slate-400 border-slate-700 bg-slate-800/40',
      icon: <Sparkles className="w-4 h-4 text-slate-500" />
    }
  }[status];

  return (
    <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium backdrop-blur-md transition-all duration-300 ${config.color}`}>
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
};

export default AIThoughtIndicator;
```

- [ ] **Step 3: Create `EndSessionModal.tsx`**

```tsx
// web/src/components/interview/EndSessionModal.tsx
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface EndSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export const EndSessionModal: React.FC<EndSessionModalProps> = ({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <DialogTitle className="text-lg font-semibold">Akhiri Sesi Wawancara?</DialogTitle>
          </div>
          <DialogDescription className="text-slate-400 mt-2 text-sm leading-relaxed">
            Apakah Anda yakin ingin mengakhiri sesi wawancara ini? Seluruh jawaban dan transkrip Anda akan disimpan, dan AI akan segera memproses penilaian portofolio kompetensi Anda.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Lanjutkan Wawancara
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30"
          >
            {isSubmitting ? "Mengakhiri..." : "Ya, Akhiri Sekarang"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EndSessionModal;
```

- [ ] **Step 4: Commit**

```bash
git add web/src/components/interview/
git commit -m "feat(web): add AudioWaveformVisualizer, AIThoughtIndicator, and EndSessionModal components"
```

---

### Task 4: Revamp `InterviewPage.tsx` with Connection HUD & Countdown Timer

**Files:**
- Modify: `web/src/pages/interview/InterviewPage.tsx`

**Interfaces:**
- Consumes: `AudioWaveformVisualizer`, `AIThoughtIndicator`, `EndSessionModal`, `sessionsApi`
- Produces: Integrated Interview HUD supporting countdown timers, connection recovery states, and graceful session termination.

- [ ] **Step 1: Integrate HUD, Visualizers, and Timer Warnings into `InterviewPage.tsx`**

Integrate state bindings for remaining time warning:
- 5 minutes remaining: Amber timer banner
- 1 minute remaining: Pulsing red time ceiling indicator
- Graceful termination modal triggering `sessionsApi.end()` or `audio_complete`

- [ ] **Step 2: Verify Build & Type Check**

Run: `cd web && npm run build`
Expected: Type check passes without error.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/interview/InterviewPage.tsx
git commit -m "feat(web): integrate modern HUD, countdown timers, and confirmation flow in InterviewPage"
```

---

### Task 5: Seeded Fault Test & Monozukuri Verification

**Files:**
- Modify: `api/app/services/sessions/end_handler.rb` (temporary scratch break)
- Test: `api/spec/services/sessions/end_handler_spec.rb`

- [ ] **Step 1: Introduce deliberate fault (bypass idempotency check)**
- [ ] **Step 2: Run RSpec to observe immediate test failure catching the defect**
- [ ] **Step 3: Revert the scratch fault and verify green tests**
- [ ] **Step 4: Document the verification in the final commit**

```bash
git commit --allow-empty -m "test(verify): prove RSpec catch rate via seeded fault demonstration on EndHandler"
```
