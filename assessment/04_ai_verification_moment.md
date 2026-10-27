# Section 04: AI Verification Moments (Senior Staff Critical Oversight)

**Author**: Wisman Nur (Lead / Senior Staff Product Engineer)  
**Standard**: Monozukuri (Craftsmanship Beyond Minimum Baseline)  
**Date**: October 2026  
**Target Branch:** `feat/monozukuri-interview-revamp-wismannur`  

---

## 1. Context & Motivation

In modern AI-augmented software engineering, Large Language Models (LLMs) accelerate code generation and boilerplate scaffolding. However, LLMs lack true architectural comprehension of:
1. Relational database triggers, cascading foreign key deletions, and transactional rollback boundaries.
2. Browser lifecycle specifications (e.g. W3C Screen Wake Lock release behavior on tab visibility changes).
3. Adversarial prompt injection attacks in real-time conversational agents.

Without rigorous senior staff scrutiny, LLM-generated solutions introduce subtle, high-severity defects that pass superficial unit tests but cause silent data loss or operational failure in production. 

This section documents concrete **AI Verification Moments** where Senior Staff intervention caught and corrected flawed AI proposals.

---

## 2. Case Study 1: The ActiveRecord Cascading Deletion Trap (P0-1)

### The Flawed AI Proposal
When prompted to resolve **P0-1** (*"Portfolio regeneration wipes human assessor overrides"*), an AI coding tool suggested the following "quick fix" in `Portfolios::Generator#save_skills`:

```ruby
# FLIMSY AI-GENERATED PROPOSAL (REJECTED):
def save_skills(portfolio, data)
  # Preserve overrides in memory array
  overrides = portfolio.portfolio_skills.map(&:assessor_override).compact

  # Destroy old skills
  portfolio.portfolio_skills.destroy_all
  
  (data['configured_skills'] || []).each do |skill_data|
    ps = portfolio.portfolio_skills.create!(...)
    # AI assumed the in-memory override object was still alive:
    matching_override = overrides.find { |o| o.portfolio_skill.skill_label == ps.skill_label }
    matching_override.update!(portfolio_skill: ps) if matching_override
  end
end
```

### Senior Staff Critical Diagnosis
1. **The Relational Cascade Trap (`dependent: :destroy`)**:
   In `PortfolioSkill`, the association is declared as `has_one :assessor_override, dependent: :destroy`. When `destroy_all` executed on parent skills, PostgreSQL and ActiveRecord immediately executed `DELETE FROM assessor_overrides WHERE portfolio_skill_id IN (...)`. The in-memory array `overrides` held frozen, destroyed records (`o.destroyed? == true`). Calling `matching_override.update!(...)` later either raised `ActiveRecord::RecordNotFound` or failed silently.
2. **Missing Transaction Boundary**:
   The AI did not wrap the wipe-and-rebuild sequence inside an `ActiveRecord::Base.transaction`. If an exception occurred during Gemini JSON parsing halfway through skill recreation, all candidate skills were already destroyed, corrupting the portfolio permanently.
3. **Loss of Assessor Metadata**:
   The AI suggestion failed to snapshot `overridden_by` and `overridden_at` audit timestamps.

### The Production Hardened Solution
We discarded the AI's proposal and implemented the detached attribute value-object snapshot pattern inside an atomic database transaction:

```ruby
def save_skills(portfolio, data)
  ActiveRecord::Base.transaction do
    # 1. Snapshot human overrides into detached Ruby hashes before destroying records
    preserved_overrides = {}
    portfolio.portfolio_skills.includes(:assessor_override).each do |ps|
      if ps.assessor_override.present?
        key = ps.skill_id.presence || ps.skill_label.to_s.downcase.strip
        preserved_overrides[key] = {
          override_level: ps.assessor_override.override_level,
          assessor_notes: ps.assessor_override.assessor_notes,
          overridden_by:  ps.assessor_override.overridden_by,
          overridden_at:  ps.assessor_override.overridden_at
        }
      end
    end

    # 2. Clean slate skill recreation
    portfolio.portfolio_skills.destroy_all

    # 3. Insert and reapply overrides from preserved value-objects
    (data['configured_skills'] || []).each do |skill_data|
      ps = portfolio.portfolio_skills.create!(...)
      reapply_override_if_present(ps, preserved_overrides)
    end
  end
end
```

---

## 3. Case Study 2: Screen Wake Lock & The Tab Visibility Trap (P2-4)

### The Flawed AI Proposal
When tasked with preventing candidate screens from sleeping during 30–45 minute interviews, an AI assistant provided this hook:

```typescript
// FLIMSY AI-GENERATED HOOK (REJECTED):
export function useWakeLock() {
  useEffect(() => {
    navigator.wakeLock?.request('screen');
  }, []);
}
```

### Senior Staff Critical Diagnosis
- **The W3C Wake Lock Specification Trap**:
  According to the W3C Screen Wake Lock API standard, **browsers automatically release all active wake locks whenever a tab is minimized, placed in the background, or loses visibility (`document.visibilityState === 'hidden'`)**.
- If a candidate momentarily switches to another window (e.g. referencing their resume or answering a recruiter message) and returns to the interview, the AI-generated wake lock was **permanently dead**! The screen would dim and sleep 5 minutes later during active speaking.

### The Production Hardened Solution (`web/src/hooks/useWakeLock.ts`)
Senior staff engineered a comprehensive hook that tracks visibility changes and automatically re-acquires the lock sentinel whenever the tab becomes visible again:

```typescript
useEffect(() => {
  if (!active || !isSupported) return;

  requestWakeLock();

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && active) {
      requestWakeLock(); // Auto-reacquire when returning to tab
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    releaseWakeLock(); // Deterministic cleanup on unmount
  };
}, [active, isSupported, requestWakeLock, releaseWakeLock]);
```
This is verified by 4 comprehensive Vitest tests in `web/src/test/useWakeLock.test.ts`.

---

## 4. Case Study 3: Hardware Audio Stream Contention & Mic Lock (P1-5)

### The Flawed AI Proposal
The AI suggested moving from `HardwareCheck` to `InterviewPage` by simply rendering the next screen component.

### Senior Staff Critical Diagnosis
- Modern web browsers enforce strict exclusive locks on hardware audio streams depending on OS drivers.
- If `HardwareCheck` does not explicitly iterate over all active `MediaStreamTrack` instances and invoke `track.stop()`, the browser holds the microphone device hostage in the background.
- When `InterviewPage` attempted to initialize its `AudioWorkletNode`, the browser threw `NotReadableError: Device in use`, completely breaking candidate onboarding.
- Senior staff instituted explicit track disposal in `HardwareCheck.tsx` and `useAudioCapture.ts`, fully covered by `HardwareCheckMicCleanup.test.tsx`.

---

## 5. Key Principles for Frontier AI Engineering

1. **Verify Relational Lifecycle Semantics**: AI models write plausible syntactical code but routinely fail to predict cascading database triggers (`dependent: :destroy`) and state mutation side effects.
2. **Model Real-World Browser Invariants**: Browser APIs (Wake Lock, MediaDevices, AudioWorklet) have nuanced lifecycle events (`visibilitychange`, unmount teardown) that naive AI prompts fail to safeguard.
3. **The Role of the Senior Staff Engineer**: AI serves as a powerful accelerator for scaffolding and ideation, but human architectural judgment remains the essential gatekeeper of data integrity, compliance, and production reliability.
