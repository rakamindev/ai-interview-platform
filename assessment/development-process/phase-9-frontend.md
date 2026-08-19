# Phase 9 — Frontend/CI changes, explained

For what a GitHub Actions workflow file actually is (jobs, steps, service containers) and why the `api` job's steps are what they are, see [`phase-9-backend.md`](./phase-9-backend.md) — not repeated here. This doc is just the `web` job, which is short because it's exactly the local commands you already know, run on someone else's machine:

```yaml
web:
  defaults:
    run:
      working-directory: web
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "20"
        cache: "npm"
        cache-dependency-path: web/package-lock.json
    - run: npm ci
    - run: npm run typecheck
    - run: npm test
    - run: npm run build
```

`npm ci` rather than `npm install` — installs exactly what `package-lock.json` pins, and (unlike `install`) fails outright if the lockfile and `package.json` have drifted, rather than silently rewriting the lockfile. That's the right choice for CI specifically: a CI run should never accidentally decide on a different set of dependency versions than a human would get locally.

The three commands after that are the same three from Phase 1's `pre-commit` hook (`npm run typecheck && npm test`), plus `npm run build` — running the actual production Vite build is the only way to catch a class of bug that `tsc --noEmit` and Vitest both miss: a type-only import forgotten `type` keyword, a dynamic `import()` path that doesn't resolve, or anything else that only breaks the real bundler pass. All three catch different things; none of the three would have caught what the other two catch, which is why the workflow runs all three rather than treating one as a stand-in for the rest.

**Node 20, not whatever's on your machine.** There's no `.nvmrc` or `package.json` `engines` field in this repo pinning a version, so I picked Node 20 (the current LTS) for the workflow explicitly, rather than leaving it to GitHub's runner default or trying to match a local dev machine's version — a CI runner should be pinned to something stable and reproducible, not implicitly coupled to whatever version happens to be installed wherever someone last ran `npm install`.

## Running it yourself

```bash
cd web
npm ci
npm run typecheck
npm test
npm run build
```
