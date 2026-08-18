# AI verification moments

AI tooling (Cursor) was used as leverage and checked against the running product, routes, and payloads. This is **not** an eval of Gemini-in-product.

## Strongest examples for the report

### AV-1 — Fake “regenerate session” API

**Suggestion:** add `POST /sessions/:id/regenerate` for a new invite after a failed interview.

**Risk:** new write path, extra auth surface, duplicate of an existing flow.

**Check:** `sessions#create` already issues invite tokens; failed sessions must not be reused (`Session.pending_invite_for` skips ended).

**Fix:** no new endpoint. Assessor “New link” calls existing `createSession`. Tests lock reuse/revoke rules instead.

### AV-2 — Interview shown as complete after an error

**Suggestion / existing copy:** treat session ended as success (“Interview complete”).

**Risk:** candidate who hit `end_reason=error` is told they finished a fair interview. They cannot opt out of this product.

**Check:** session model `END_REASONS` includes `error`; complete screen did not branch on it.

**Fix:** interrupted state + copy, and assessor recovery via a new pending invite. Status pill maps `ended` + `error` to failed, not completed.

### AV-3 — HTTP Gemini on `v1` while Live already used `v1beta`

**Suggestion / baseline code:** portfolio HTTP client on `https://generativelanguage.googleapis.com/v1`.

**Risk:** generate always fails for current models; assessor sees a stuck/failed portfolio that looks like “our product is broken” rather than a version mismatch.

**Check:** Live WebSocket URL already used `v1beta`. Hitting `v1` returned 404 for preview models.

**Fix:** same `v1beta` base as Live (`Gemini::HttpClient::BASE_URL`). That is a verified API fact, not a prompt guess.

### AV-4 — Fit-gap field names the UI already expected

**Suggestion:** expose only `expected_level` / `overridden` from the engine.

**Risk:** comparison table required `required_level` / `is_override`; unassessed rows looked like empty data.

**Check:** frontend types vs `FitGap::Engine#build_skill_comparisons` payload.

**Fix:** API sends both names; FE `normalizeSkillComparison` accepts either. Specs fail if `not_assessed` or the alias disappears.

### AV-5 — Vacancy prefill marked taxonomy skills as custom

**Suggestion:** copy `skill_label` + level into the assessment form as custom rows.

**Risk:** null `skill_id` on vacancy skills (legacy + intentional custom skills) dropped taxonomy anchors.

**Check:** DB rows and `SkillPicker` (needs a real `skill_id` for catalog skills).

**Fix:** resolve taxonomy by id, then by label; unmatched labels stay custom. `vacancySkills` payload keeps `skill_id: null` only for true custom rows.

### AV-6 — PDF 500 treated as a frontend download bug

**Suggestion:** debug `FitGapReportPage` / blob download; JSON succeeding meant the export API was fine.

**Risk:** assessor with a human override (the hero path) still got HTTP 500 from `prawn/fonts/afm.rb`. JSON is UTF-8; PDF is Win1252. A first sanitizer on Gemini fields still leaked the template string `AI: L3 → Override: L2`.

**Check:** Network tab `export?format=pdf`; `Exports::PdfGenerator` default font; override present on the skill.

**Fix:** every `pdf.text` / table cell through `pdf_safe` (UTF-8 → Windows-1252 replace → UTF-8). Request spec covers override notes plus Gemini punctuation. Not an embedded Unicode font — unsupported glyphs render as `?`.

## Smaller catches

| ID | What AI/codegen got wrong | Correction |
|----|---------------------------|------------|
| AV-7 | Hardware retry only ran on mount (`useEffect` `[]`) | Retry must react to `LOADING` / a run id so stale async is ignored |
| AV-8 | List pagination as a product requirement | Assessor needed search/filter; page size vs API cap added noise. Reverted to full list + `60vh` overflow |
| AV-9 | Encrypt login password in the browser | Normal HTTPS POST. No custom FE crypto |

## Rule used

If a suggestion invents an endpoint, a new table, a “complete” state without reading `end_reason` / `generation_status`, or treats a 500 as frontend-only because a sibling JSON path works, reject it and write the check into a test when it sits on the hero seam.
