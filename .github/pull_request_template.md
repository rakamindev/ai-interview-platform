## What and why

<!-- 2–4 lines. What problem this fixes, for whom (candidate, assessor), and why it matters. -->

## What changed

-

## How I tested

- Commands and results:
- Manual checks (screen widths, keyboard) and screenshots:

## Checklist

- [ ] New tests were watched failing before the fix
- [ ] No secrets and no real personal data (code, fixtures, screenshots, logs)
- [ ] Migrations run migrate → rollback → migrate cleanly
- [ ] No `.catch(() => {})`: every failure shows a message and a way forward
- [ ] Touched screens: loading, empty, error and success states; tokens only (no raw colours); keyboard and focus work; no horizontal scroll at 360/390 and 768/1280
