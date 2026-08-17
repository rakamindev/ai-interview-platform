## 1. Route matching helper

- [x] 1.1 Add `isAuthPath(pathname)` and `isInterviewPath(pathname)` predicates (auth = `/login`, `/signup`, `/access-denied`; interview = prefix `/interview/`), with a comment cross-referencing the `App.tsx` route table
- [x] 1.2 Add a unit test asserting each path family maps to the expected variant (auth, interview, assessor, and unmatched → assessor default)

## 2. Route-aware skeleton variants

- [x] 2.1 Extract the current `BrandedSkeleton` markup into an internal `AssessorSkeleton` variant (default, behavior unchanged)
- [x] 2.2 Add an internal `AuthSkeleton` variant: two-column split on `lg` (solid teal side-panel placeholder + centered form-field placeholders), single centered column on small viewports, no assessor nav
- [x] 2.3 Add an internal `InterviewSkeleton` variant: minimal non-sticky header + narrow `max-w-xl` centered content placeholder, no assessor nav
- [x] 2.4 Update `BrandedSkeleton` to read `useLocation()` and render the variant via the predicates, defaulting to `AssessorSkeleton`

## 3. Verify

- [x] 3.1 Add tests rendering `BrandedSkeleton` in a `MemoryRouter` at `/login`, `/interview/abc`, and `/assessments`, asserting the distinguishing element per variant and the absence of assessor nav on the auth/interview variants
- [x] 3.2 Run `vp check` and `vp test` and resolve any lint/type/test failures
- [ ] 3.3 Manually cold-load (throttled) `/login`, `/signup`, `/access-denied`, `/interview/:token`, and an authorized route to confirm each silhouette matches its shell with no mismatched flash
