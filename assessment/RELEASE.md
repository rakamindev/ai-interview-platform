Case-study submission materials for the evidence-based fit/gap review.

- Single PDF: execution narrative, domain context, severity-ranked findings, acceptance criteria, trade-offs, implementation, screenshots, test and seeded-fault proof, AI verification, and limits.
- Video: 3:30 captioned walkthrough with real browser footage using synthetic data; simulated failure response is labeled; no spoken narration.

Code: https://github.com/rakamindev/ai-interview-platform/pull/192

Validation: 61 backend examples, 11 frontend tests, 4 browser regression tests, scoped mobile accessibility, migration down/up with existing rows, and frontend production build. The live Gemini interview was not verified against the live service. All candidate data shown is synthetic.

PDF revision, 26 October 2026: 12 pages with readable evidence crops, Title Case headings, no repeated synthetic-data footer, scoped interaction claims, a concrete public-service observation, closer queue-recovery trade-offs, and exact source/CI evidence. The original dependency-audit output was not retained, so exact historical severity attribution has been removed. No new application verification is implied.

Revised PDF SHA-256: `740210b13f25038daf27811211b4dc8ec49a35ec75dd92582571a583177c4c50`.
