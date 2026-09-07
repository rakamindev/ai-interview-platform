# Step 3: Problem & Gap Analysis

## Why two sides, not four

Assessor, Recruiter, and Hiring Manager aren't actually distinguished by the system. Every controller (`assessments`, `vacancies`, `sessions`, `portfolios`) is gated by the same check:

```
authorize_auth_token! :assessor
```

which accepts any JWT with role `admin` or `assessor`. So this report uses:

1. **Internal** (Assessor, Recruiter, Hiring Manager, one access tier today)
2. **Candidate** (external, token-based, no account)

Each row: severity, category (missing spec vs defective implementation), service, evidence, one-line impact.

---

## Constraint Signals

1. **No test suite, no CI.** RSpec has zero specs, no pipeline. Rows tagged "confirmed live" were reproduced by hand; the rest is static code tracing. Prerequisite to fix before Step 5.
2. **Gemini API key format changed in September.** Blocks live verification of interview audio, Portfolio generation, and Fit/Gap narrative. A Portfolio stuck at `generating` is consistent with this, not a separate bug. Confirm once the key is fixed. This is also likely the root cause behind the majority of sessions ending with `end_reason: 'error'` (see Candidate P0 on the misleading completion screen), since Gemini reconnection failing repeatedly is the only code path that produces that reason. Bukti: `ss_portfolio_generation_failed.png` (di `assessment/evidence/`) menunjukkan Portfolio Results untuk kandidat "Kaira" berhenti di "Portfolio generation failed."
3. **Role model is a product decision.** What Recruiter/Hiring Manager can do differently from Assessor will be defined explicitly in Step 4, not guessed here.

---

## Internal Side (Assessor, Recruiter, Hiring Manager)

| Severity | Finding | Category | Service | Evidence | Impact |
|---|---|---|---|---|---|
| P0 | No authorization separation between internal personas. | Missing specification | `api/`, every controller | `authorize_auth_token! :assessor` accepts both `admin` and `assessor` everywhere, e.g. `assessments_controller.rb:6`, `vacancies_controller.rb:6`, `sessions_controller.rb:6`, `portfolios_controller.rb:6`. Assessor, Recruiter, and Hiring Manager are three personas named in the brief and implied by the UI, but the backend only ever checks for one role tier (`assessor`). There is no `recruiter` or `hiring_manager` role in the system at all, so all three are technically the same account type today. | Any assessor-level token can edit, delete, or view everything. No least-privilege boundary. |
| P0 | Skills never discussed still get a fabricated L1–L5 score. | Defective implementation | Seam `api/` ↔ `web/` | `generator.rb:161` and `:173`: `skill_data['level'].to_i.clamp(1,5)` turns a missing level into `1`. | Fit/Gap computes a "gap" from a score that was never earned, instead of `not_assessed`. |
| P1 | `save_skills` has no transaction. | Defective implementation | `api/` | `generator.rb:154` (`destroy_all`) + `:157`/`:169` (`create!` loop), no surrounding `transaction`. | A failed record mid-loop leaves a partial write, and the portfolio gets marked `failed` over half-committed data. Same generator as the P0 above, so it compounds the scoring-integrity risk. |
| P2 | Internal coverage-tracking JSON leaks into the transcript both the candidate and the assessor see. | Defective implementation | Seam `api/` ↔ `web/` (`audio_websocket_middleware.rb:272–279`) | `sanitize_output_transcription` strips the JSON payload only if the text starts with `{` (`text.sub(/\A\s*\{.*?"discovered"...\}\s*/m, '')`, line 275). When Gemini splits the payload across turns, the leftover fragment starts with a bare `,` instead of `{` and skips the filter untouched. Confirmed live: same raw fragment (`"discovered": [], "time_remaining_minutes": 25, "pacing": "on_track"...`) appears verbatim in both the candidate's chat bubble and the assessor's Live Monitor transcript. Screenshot: `ss_json_leak_live_monitor.png` (assessor side) and `ss_json_leak_candidate_chat.png` (candidate side). | Both sides occasionally see raw internal state instead of a clean transcript. Confusing for the candidate mid-interview, and it undermines trust in the transcript an assessor reviews afterward. Confirmed happening right now, not just a theoretical risk. |

---

## Candidate Side

| Severity | Finding | Category | Service | Evidence | Impact |
|---|---|---|---|---|---|
| P0 | No exit confirmation, no resume once left; timer keeps running. | Missing specification (never built) | `web/` (`InterviewPage.tsx`) | `InterviewPage.tsx` has no `beforeunload`/`popstate` guard anywhere. Confirmed live: back button exits immediately; reopening the link only offers "End Interview," never resume. | Candidate can permanently lose their one attempt via accidental navigation. |
| P0 | Fabricated scores feed directly into the candidate's evaluation outcome. | Defective implementation | Seam `api/` ↔ `web/` | Same root cause as the internal P0 above. | Candidate can fail on a skill the AI never asked about. A real hiring decision, not just bad data. |
| P0 | The completion screen always says "✅ Interview Complete," even when the session ended in error. | Defective implementation | `web/` (`useAudioWebSocket.ts:100-107`, `InterviewPage.tsx:180`) | When Gemini reconnection fails after max attempts or the browser disconnects past the grace period, the backend sends `session_ended` with `reason: 'error'` and a message telling the candidate to contact the interviewer (`audio_websocket_middleware.rb:387-388`, `:510`). The frontend hook discards both the reason and the message and just calls `onStateChange("complete")`, so the generic success screen renders regardless. Likely the same root cause as Constraint #2 (Gemini key). Not an edge case: of the 12 sessions in the reviewed assessment, 8 show `end_reason === "error"` (rendered as "Failed" per `AssessmentInvitePage.tsx:69-73`), so this is the majority outcome right now, not a rare failure. Screenshot: `ss_failed_sessions_majority.png` (assessment list showing 8 of 12 candidates as Failed) and `ss_interview_complete_generic.png` (the same generic completion screen a candidate sees, error or not). | Most candidates who fail are never told their interview didn't actually go through. They see the same "the hiring team will review your results" message as a candidate who succeeded, and HR is left waiting on results that don't exist. |
| P1 | No mechanism to retain or delete the candidate's own data. | Missing specification | `api/` | Same evidence as the internal P1. | No opt-out, no deletion request path. A real UU PDP gap. |
| P2 | Transcript panel doesn't auto-scroll to the newest turn. | Defective implementation | `web/` (`InterviewPage.tsx`) | Transcript container (`overflow-y-auto max-h-[60vh]`) has no ref/scroll-anchor logic. Confirmed live: new turns render off-screen while waiting on the AI. | Candidate can miss the AI's latest question or their own last answer during a timed, one-shot interview. |

---

**On the data-deletion rows (Internal P1 / Candidate P1):** hard delete isn't safe as-is. `Session` cascades correctly in Rails, but `Portfolio` has no association to `fit_gap_reports`, and that foreign key has no `on_delete`. Destroying a portfolio with an existing Fit/Gap report throws an unhandled FK violation. A soft-delete/anonymize approach (`deleted_at` + PII scrub, excluded from all reads) satisfies the same UU PDP request without touching that gap, and is the direction this leans toward for Step 4.

---

## Summary

Most P0s trace back to three root causes: the missing role model, `Portfolios::Generator` forcing a numeric score onto every skill regardless of whether it was discussed, and the frontend silently discarding the backend's error state on session end. Fixing the scoring gap resolves most of the fairness and data-integrity impact on both sides, since Fit/Gap already handles `not_assessed` correctly downstream. Fixing the error-state handling (surfacing `end_reason` instead of always showing "complete") is now the highest-frequency fix on the candidate side, given how many sessions already end this way. The role-model decision is bigger, and it will get its own escalation and direction in Step 4.
