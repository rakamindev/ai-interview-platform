# Problem

[VERIFIED-CODE] A malformed model level can become L1, so a skill never discussed can be reported as a three-level, high-confidence gap and the assessor cannot see that the rating lacks evidence.

# What I found

[VERIFIED-CODE] The top findings are the false-L1 persistence path, destructive regeneration of overrides, and omitted fit/gap provenance; see [findings.md](findings.md).

# What I propose

Adopt Option B: nullable `ai_level` plus `rating_status` and `unrated_reason`; API comparison, table state, and portfolio UI already contain uncertainty vocabulary, while persistence does not.

# What I did not do, and why

[VERIFIED-CODE] This is documentation only; implementation belongs to a separate PR.

[VERIFIED-RUNTIME] No real interview ran and no Gemini key was available.

# How to verify

```sh
cd api
PATH=/opt/homebrew/opt/ruby@3.3/bin:$PATH OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES WEB_CONCURRENCY=0 bundle exec rails server
cd ../web && npm run dev
```

After authenticating as the seeded assessor, verify the final UI at http://localhost:5173/assessments/1/sessions/1/fitgap/1.
