# Submission package

- [Open upstream PR #192](https://github.com/rakamindev/ai-interview-platform/pull/192)
- [Single PDF report](submission.pdf)
- [3:30 captioned walkthrough](https://github.com/dixonfrederick/ai-interview-platform/releases/download/case-study-review-v1/review-walkthrough.mp4)
- [CI execution history](https://github.com/dixonfrederick/ai-interview-platform/actions?query=branch%3Afeat%2Freliable-assessment-review)
- [Reproducible setup and checks](RUNBOOK.md)
- [Discovery, acceptance criteria, and alternatives](01-discovery-and-plan.md)
- [Product context and primary sources](02-product-context.md)
- [AI verification and seeded-fault proof](AI-VERIFICATION.md)
- [Scoped application design record](DESIGN-QA.md)
- [Revised report delivery gate](REPORT-QA.md)
- [Report audit and corrections](../anti-slop/follow-up-001-2026-10-26.md)
- [Technical-defense preparation](DEFENSE.md)

The selected change is the portfolio-to-vacancy review workflow, across Rails and React. All demonstrated candidate data is synthetic. Failure/long-text/empty UI response simulations are labeled. The video includes real browser footage and explanatory text, with no spoken narration. The original live microphone/Gemini interview was not verified against the live service; its model response/failure handling is tested with controlled clients.

Recorded validation: 61 backend examples, 11 frontend tests, 4 browser regression tests, a recorded end-to-end workflow, scoped mobile accessibility, reversible migration with existing rows, and production frontend build. The scratch arithmetic fault caused 28 of 35 comparison examples to fail and was visibly reverted. Production npm audit has zero reported advisories; inherited development-tool advisories are documented in the report.

Rebuild the PDF with Python and `reportlab`/`Pillow` installed:

```sh
python assessment/build_report.py --output assessment/submission.pdf
```

The editable video project is in `demo/`. Its assets are real screenshots and the recorded workflow; `npm ci` then `npm run dev -- --no-open` opens the preview. Render the `ReviewWalkthrough` composition for a 210-second MP4.

The candidate must review and understand the implementation, verify the exact dashboard deadline, and upload the single PDF to the hiring portal. No portal submission or live technical defense has been performed by the assistant.

Report revised 26 October 2026: 12 pages, consistent Title Case, enlarged evidence crops, and a footer without the repeated synthetic-data phrase. Fixture and simulation disclosures remain in the body/captions. Application/test evidence is pinned to fd15a9d and exact successful CI run 40207781087. This document revision adds no application coverage; full keyboard traversal and the live Gemini interview remain unverified.
