# Hiring decision integrity

This note is the execution record for the backend-focused submission.

## Problem

The product decides whether a candidate meets a role. The fit/gap engine could turn a missing model level into L1, because `nil.to_i.clamp(1, 5)` is 1. That is a defective implementation: the level was specified as 1 to 5, and a missing value was stored as the lowest level. A person who was not rated looks foundational.

A second defect sits on the seam with the screen. Comparisons were stored as `expected_level`. The screen read `required_level`, so the bar was blank. Unassessed skills were also dropped from the fallback narrative, so a model timeout could read as a clean recommendation.

Regeneration deleted portfolio skills, and assessor overrides with them, before the new payload was known to be valid. Two workers could both call the model for the same session. Failure logs stored `exception.message`, which can carry model output and candidate quotes. That is the UU PDP constraint to escalate: do not persist or log interview evidence inside an error string.

## Rule

- A level is stored only when it is an integer 1 through 5, or the strings `1`–`5` and `L1`–`L5`.
- Confidence is stored only as high, medium, or low.
- Anything else is an omission, not a skill row. Omissions are listed on the portfolio.
- Skill replacement runs in a transaction. Overrides are copied by skill id, or by normalized label when there is no id, and restored after the new rows exist.
- A second portfolio job skips while `generating` is younger than 10 minutes. A second fit/gap job skips while its claim is younger than 3 minutes.
- Verdict: hold when nothing is required, any skill is unassessed, or confidence is low. Decline only for a confident gap after every required skill is assessed. Advance only when every required skill meets the bar.

## Trade-off

Option A, chosen here, keeps the verdict in deterministic Ruby and lets the model write narrative around it. The model cannot outvote a missing rating.

Option B was to ask the model for the verdict. That reads more fluently and is wrong when the model omits a skill or returns a fenced JSON blob. Option C was a nullable `ai_level` so an unassessed skill stays as a row. That is a larger migration and a wider contract change. Omitting the row, and recording why, keeps the existing check constraint and still shows the skill as not assessed during comparison.

## Verification

The rules are specified in `api/spec` and do not need PostgreSQL. They are wired to CI in `.github/workflows/decision-integrity.yml`. The suite was run with Ruby 3.3.2: 24 examples, 0 failures.

A review of the first engine edit found a real fault: the narrative prompt referenced `decision` without receiving it. That would raise `NameError` on every report and always take the fallback. The prompt method now takes the decision explicitly. Error logs keep the exception class and drop the message.

## Screen

The fit/gap page shows the verdict, the blocking skills, and both narratives. The required column reads `required_level`, with `expected_level` as a fallback for rows already stored.
