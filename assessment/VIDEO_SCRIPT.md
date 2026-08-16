# Video walkthrough — 4 minutes

The brief asks for 3–5 minutes covering **end-to-end user flow, problem clarity, and feature enhancements**. Screen recording with voice. Unlisted YouTube or Loom.

Before recording: `make up`, log in as `assessor@test-corp.local`, and open the four sessions in tabs so nothing is loading on camera.

| Sessions to have ready | Shows |
|---|---|
| Rani Wibowo | partial coverage — the main state |
| Dimas Prakoso | empty |
| Ayu Lestari | generation failed |
| Bagas Nugroho | generating |

---

## 0:00 — The problem, on screen (45s)

Open the portfolio for **Rani Wibowo**. Scroll to the three "Not assessed" cards.

> "This is a skill portfolio. Before this change, all three of these read **Level 1** — the bottom of the scale — because the model returned nothing and the code did `.to_i.clamp(1, 5)`. `nil.to_i` is zero, and zero clamps up to one. A skill the interview never touched looked identical to a skill the candidate genuinely scored lowest on. The recruiter had no way to tell."

Don't explain the fix yet. Let the problem land.

## 0:45 — What a recruiter sees now (60s)

Point at the banner first, then the cards.

> "It says up front: three of seven were not assessed, and it groups them by reason — one never came up, one didn't produce enough evidence, one failed analysis. Those are three different things to a hiring manager. And the closing line is the whole point: an unassessed skill is not a low score."

> "The badge is a dashed outline, deliberately not the filled grey that L1 uses, so it can't be misread as the bottom of the scale. Evidence and confidence are hidden rather than shown empty."

Open **Override rating** on an unassessed skill.

> "Override still works here. That matters — the skills the AI couldn't rate are exactly the ones that need a human. Before, override was only reachable on skills that already had a rating."

## 1:45 — Fit/gap (30s)

Run the fit/gap report.

> "Same honesty downstream. Unassessed skills get their own row instead of being counted as a match or a gap, and the count is stated below the table — so 'Match: 2' can't stand in for the whole picture when three of six were never assessed."

> "The Required column here was blank on every row before this change. The frontend read `required_level`; the API sends `expected_level`. So 'Gap minus one' was displayed with nothing to compare against."

## 2:15 — The tenant hole (45s)

Terminal, side by side with the code.

> "Every authorization check in this service reads the tenant out of the JWT. That claim was minted at login from the caller's own header."

Show `resolve_scheme` before, then run:

```
curl -X POST localhost:3001/api/v1/auth/login \
  -H 'X-Tenant-Scheme: victim-corp' \
  -d '{"email":"assessor@test-corp.local","password":"password123"}'
```

Decode the token on screen.

> "Valid credentials, one extra header, and you used to get a correctly signed token for someone else's organisation. Now it's ignored — the tenant comes from the user's own record. The reason it was written that way is that `users` had no organisation column at all, so this needed a migration, not a patch."

## 3:00 — Proof (45s)

Terminal: `make test`. Then switch to the seeded-fault branch.

> "66 backend examples and 48 frontend tests — the repo had zero specs and no frontend test runner when I started. To show the tests are real rather than decorative, this branch puts the original defect back."

Run the suite red.

> "Fourteen backend failures, nineteen frontend. And these two uncaught exceptions are the crash that would have shipped if the API fix had merged without the frontend one — `parseLevel(null)` throws and the page white-screens. That's why those PRs were held until the frontend was ready."

## 3:45 — Close (15s)

> "The change I'd make next, and deliberately didn't make under this deadline: tenant scoping fails open outside an HTTP request, so Sidekiq workers run unscoped. Making it fail closed is one line and turns every background job into a silent no-op. The HTTP surface is closed; that one's written up in the report as an escalation."

---

**Don't** narrate the file tree, the Docker setup, or the PR structure. The report covers those and the clock is the constraint.
