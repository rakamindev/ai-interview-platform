# Video Demonstration Script: AI Interview Platform Revamp
**Role:** Fullstack Product Engineer  
**Duration:** 3 – 5 Minutes  
**Format:** Loom / YouTube Unlisted / Google Drive Video Walkthrough  

---

## Storyboard & Timing Breakdown

| Timestamp | Section | Visual on Screen | Key Talking Points |
|---|---|---|---|
| **0:00 – 0:45** | **1. Introduction & The Product Problem** | VS Code & GitHub PR view showing `revamp/fullstack-product-engineer` | • Introduce yourself as the candidate Product Engineer.<br>• Explain the core mission: AI interview platform for hiring in Indonesia.<br>• Highlight the critical baseline flaws discovered: Fit/Gap contract mismatch rendering the "Required" column blank, portfolio regeneration wiping out human assessor overrides, and candidate sessions getting trapped when candidates mention spontaneous skills. |
| **0:45 – 1:30** | **2. Candidate Empathy & Indonesian UU PDP** | Browser view of `/interview/:token` | • Emphasize that candidates never chose an AI evaluator; fairness and legal consent are paramount.<br>• Demonstrate the new **UU PDP No. 27/2022 Statutory Notice** card.<br>• Show that microphone capture cannot start without explicit informed consent, honoring Article 4 & 20 of UU PDP.<br>• Show the collapsible legal policy breakdown (encryption, human-in-the-loop guarantee, no public model training). |
| **1:30 – 2:30** | **3. End-to-End Assessor Flow & Monozukuri UI** | Browser view of Portfolio & Fit/Gap screen (`/portfolios/:id/fitgap/:vacancyId`) | • Show the Fit/Gap evaluation screen: the "Required" column is now properly populated with L1–L5 anchors.<br>• Demonstrate human assessor overrides: adjust a skill level from L2 to L4 with detailed interview notes.<br>• Show the `✏ Override` badge in the Fit/Gap table with rich hover details.<br>• Trigger portfolio regeneration: prove that the human override and notes **persist intact**, with the AI level cleanly updated to the new baseline. |
| **2:30 – 3:30** | **4. Architecture & Preventing Edge Cases** | Code view (`map_injector.rb`, `engine.rb`, `portfolios_controller.rb`) | • Walk through the **Candidate Trapping Prevention**: how `MapInjector#all_covered?` now uses a time-aware safety window so initiated discovered skills never hold the session hostage.<br>• Walk through **Duplicate Background Job Elimination**: how Redis in-progress keys return HTTP 202 instead of 404 polling storms. |
| **3:30 – 4:30** | **5. Testing Harness & The Seeded Fault Test** | Terminal split view running `bundle exec rspec` and `yarn test` | • Run the RSpec suite (25 examples, 0 failures) and Vitest suite (9 tests, 0 failures).<br>• Highlight the **Seeded Fault Test**: explain how deliberately corrupting the required level contract failed the test suite with red output, proving tests are meaningful assertions and not shallow checks.<br>• Mention the **AI Verification Moment** (LLM proposing destructive updates vs robust in-place reconciliation). |
| **4:30 – 5:00** | **6. Conclusion & Trade-off Reflection** | Assessment report summary | • Summarize why Option A (In-Place Reconciled Relational Architecture) was chosen over Option B (Event-Sourced Append-Only Ledger).<br>• Reiterate commitment to Monozukuri: craftsmanship, system rigor, and candidate respect. |

---

## Spoken Transcript / Voiceover Guide

### Minute 0:00 – 0:45 (Introduction & Problem Discovery)
> "Hello! My name is [Your Name], and this is my walkthrough of the Fullstack Product Engineer revamp for the Rakamin AI Interview Platform.
> 
> As a product engineer, my priority was not just making lines of code work, but asking: *what is the real user experience for both recruiters and candidates, and where does this product fail them today?*
> 
> Walking through the codebase end-to-end, I uncovered three severe P0 and P1 issues:
> First, on the Fit/Gap report screen, a backend contract mismatch (`expected_level` vs `required_level`) rendered the 'Required' column completely blank.
> Second, whenever a portfolio was regenerated, `portfolio.portfolio_skills.destroy_all` cascaded and permanently deleted all human assessor overrides and notes.
> Third, if a candidate spontaneously mentioned an off-agenda topic, that discovered skill became trapped in an 'initiated' state, preventing the session wrap-up from ever firing until a hard timeout cut the candidate off."

### Minute 0:45 – 1:30 (Candidate Experience & UU PDP)
> "Next, let's look at the candidate experience. Candidates do not choose to be interviewed by an AI, and their voice data represents sensitive biometrics under Indonesian law.
> 
> Here on the interview screen, I implemented full compliance with Indonesia's Personal Data Protection Law (UU PDP No. 27/2022). Before microphone access is requested, the candidate is presented with a clear, accessible Statutory Notice. It outlines four guarantees: audio encryption, non-training of public models, candidate deletion rights, and crucially, human-in-the-loop oversight. Microphone activation is gated behind this explicit consent checkbox."

### Minute 1:30 – 2:30 (Assessor Workflow & Fit/Gap Revamp)
> "Now let's switch to the assessor workflow. On the Fit/Gap page, the comparison table now accurately pairs candidate ratings against vacancy requirements.
> 
> When an assessor reviews a candidate and overrides an AI score—say, elevating Rails from L2 to L4 with specific probe notes—that override is immediately reflected in the comparison table with a distinctive `✏ Override` badge and tooltip.
> 
> When we regenerate the portfolio, our new reconciliation logic matches existing skills by ID and label, updating the AI baseline while preserving the human override and notes with zero data loss."

### Minute 2:30 – 3:30 (System Rigor & Race Conditions)
> "On the backend architecture, we solved two critical stability bottlenecks:
> In `MapInjector`, we removed the indefinite blocking rule on discovered skills. If the required agenda is covered and time is short, the session naturally wraps up with a warm AI farewell.
> In `PortfoliosController`, we eliminated a severe race condition where 404 polling triggered duplicate Sidekiq jobs every 5 seconds. We added Redis in-progress tracking and HTTP 202 Accepted status responses."

### Minute 3:30 – 5:00 (Test Harness, Seeded Fault, & Monozukuri)
> "Finally, let's look at automated verification. We built a full test harness from scratch: 25 RSpec specs on the Rails API and 9 Vitest specs in React.
> 
> To prove the tests are genuine, we executed a Seeded Fault Test on a scratch branch—corrupting the contract payload caused immediate assertion failures in red, which we reverted cleanly.
> 
> This is Monozukuri: craftsmanship, uncompromised system rigor, and deep respect for the people who use our software. Thank you!"
