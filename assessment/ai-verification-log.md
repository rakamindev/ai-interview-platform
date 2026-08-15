# AI verification log

The brief requires documenting at least one instance where AI code generation was
wrong or risky, and how it was verified or corrected. These are recorded as they
happened, with the check that caught each one.

---

## 1. Invalid Ruby generated in a factory — caught by `ruby -c`

**Produced:**
```ruby
trait :pending    { generation_status { 'pending' };    generated_at { nil } }
```

**Why it is wrong:** in Ruby a brace block binds to the nearest expression, so
this parses as `trait(:pending { ... })` — a syntax error, not a trait
definition. It reads plausibly because `factory_bot` uses brace blocks
everywhere else in the same file.

**Caught by:** running `ruby -c` on the generated file. Since the Rails suite
could not be executed in this environment (Ruby 3.0.2 against the repo's 3.3.2,
no bundler, no PostgreSQL), a syntax check was the only automated feedback
available, so it became a standing rule for every generated Ruby file
thereafter — 30+ files, no further parse errors.

**Corrected to:** `trait :pending do ... end`.

---

## 2. Two specs that would have passed without testing anything

**Produced:** a spec asserting that an overridden skill survives when the model
stops returning it, driven by the stub's `:no_skills` mode.

**Why it is risky:** `:no_skills` returns an empty response, which raises
`EmptyResponseError` *before* the retire-and-supersede path ever runs. The
example would have gone green while exercising none of the behaviour it
claimed to cover — the most dangerous kind of test, because it is later cited
as evidence.

**Caught by:** tracing the control flow by hand before running, rather than
trusting a passing result.

**Corrected to:** removing the skill from the coverage map, so the contract
genuinely stops emitting it and `retire_missing` is actually executed.

---

## 3. Duplicated accessible text — caught by a test, fixed in the component

**Produced:** `ComparisonTable` rendered the string "Not assessed" twice per
row — once as the result badge, once as an `sr-only` label in the Candidate
column.

**Why it is wrong:** a screen reader announces the same verdict twice for every
unassessed row. The test failed with "found multiple elements".

**Caught by:** `ComparisonTable.test.tsx`.

**Corrected by:** changing the `sr-only` text to "No rating recorded" — fixing
the component, not the assertion. Loosening the query to `getAllByText` would
have made the test pass while leaving the accessibility defect in place, and
weakening an assertion to make a check pass is an automatic decline under this
brief.

---

## 4. A fail-closed scope that would have made the security specs meaningless

**Risk identified during design, not after failure.** `for_current_tenant`
returns `none` when there is no tenant in context. That is the right default,
but it means a bug scoping *everything* to `none` would make every
cross-tenant isolation example pass while breaking the product entirely.

**Mitigation:** every isolation example in
`portfolio_tenant_isolation_spec.rb` is paired with a positive case proving the
owning tenant still succeeds. The negative assertions are worthless without
them.

---

## 5. The proposal to denormalise `tenant_id` — rejected

The obvious fix for the cross-tenant leak is to add `tenant_id` to
`portfolios`, `portfolio_skills` and `fit_gap_reports` and include
`TenantScoped`. It is the smaller diff and the more familiar pattern.

**Rejected because** it creates a second source of truth for tenancy. A copied
`tenant_id` can drift out of agreement with its session — through a backfill, a
restore, or a bug in a writer — and a leak caused by drift is silent, which is
the worst property a data-protection control can have. Scoping through the
association chain to `sessions` keeps one authority. The cost is a join on
every lookup, which is acceptable at this read volume and is documented in the
trade-off matrix.

---

## 6. Standing caveat: the Ruby is unexecuted

Roughly 40 specs and all backend changes were written without being run, for
the environment reasons above. Every file parses; none is proven. The
frontend, which could be executed, is verified: `tsc --noEmit` is clean and
16 tests pass.

This is the honest boundary of "AI as leverage you verify, not an oracle you
trust". The leverage is real; the verification step on the backend is still
owed and is the first task on picking this up.

---

## 7. The syntax check was weaker than it looked

**Discovered during a final validation pass**, not during the work.

`ruby -c` was used on every generated file as the only automated feedback
available (entry 1). Running it across the whole tree at the end surfaced five
"failures" — all in files never touched, all reporting a syntax error on
Ruby 3.1+ shorthand hash literals:

```ruby
{ errors: [{ status: Rack::Utils.status_code(status), message: }] }
```

The sandbox has **Ruby 3.0.2**; the repo requires **3.3.2** (`api/.ruby-version`).

**Why it matters:** "every file passes `ruby -c`" was true, but under an
interpreter two minor versions behind the one the code targets. It proves the
files are not malformed under 3.0 grammar. It does not prove they parse under
3.3, and it never had any chance of catching a semantic error.

**Corrected, then actually resolved.** The claim was first restated with its
version caveat. Then the underlying gap was closed: `@ruby/prism` — Ruby's own
parser, distributed as WASM via npm — parses 3.3 grammar independently of the
installed interpreter.

All **103** Ruby files in `api/` parse cleanly under Ruby 3.3, including the five
that Ruby 3.0.2 rejected.

Two negative controls were run first, because "0 failed" is worthless from a
checker that cannot fail:

1. A deliberate syntax error injected into a copy of `ResponseContract` — caught.
2. A 3.1+ shorthand hash literal — rejected by `ruby -c` under 3.0.2, accepted by
   prism, confirming it is genuinely applying 3.3 grammar rather than defaulting
   to the host interpreter's.

**What this proves and does not prove:** every file is syntactically valid under
the Ruby version the app targets. It says nothing about whether the specs pass,
whether the methods called exist, or whether the migrations run. Those still
require the Rails stack.

---

## 8. Numbers in the documentation drifted from the code

A validation pass comparing every numeric claim in the reports against the
repository found five wrong: generator specs claimed 20 (actual 18), fit/gap
specs claimed 14 (actual 13), acceptance-criteria rows claimed 70 (actual 49),
commit count claimed 14 (actual 15), and the backend total claimed 45 before a
worker spec was added (actual 48).

**Why it matters:** none is load-bearing, and that is exactly the problem. A
reviewer who checks one number and finds it wrong has no reason to trust the
ones they did not check. In a submission whose central argument is that this
product asserts things it cannot support, overstating its own test counts would
have been the worst possible unforced error.

**Caught by** scripting the comparison rather than re-reading the prose.
