# Captioned case-study walkthrough

This editable Remotion project produces the 210-second (3:30) submission video. It uses actual application screenshots and a real browser recording against the isolated local Rails API and Sidekiq worker, with synthetic candidate fixtures. The failure screenshot is explicitly labeled as a response simulation. There is no spoken narration.

```sh
npm ci
npm run dev -- --no-open
npx remotion render ReviewWalkthrough out/review-walkthrough.mp4
```

Node >=22.13 is supported by the video tooling. If a system Chrome is used, pass its executable with Remotion's `--browser-executable` option. The application frontend has its own package file and setup in `web/`; the video project is documentation tooling only.

Scenes: problem, observed baseline defect, real workflow, evidence/provenance, recovery, verification, and trade-offs. Each scene is registered separately in Studio. Source screenshots and fixture footage are in `public/`; they are not fabricated UI mockups. To record fresh workflow footage, run `web/e2e/walkthrough.spec.ts` with the application running and seeded.
