# Phase 1 — Frontend changes, explained

You already know React, TypeScript, npm, and testing concepts in general. Nothing about the *language* is new here. What's new to **this project** is a handful of tools it didn't have before: Vitest, Testing Library, jsdom, and Husky. This doc is a walkthrough of those, not a React tutorial.

For Ruby/Rails terms mentioned in passing (gem, RSpec), see [`phase-1-backend.md`](./phase-1-backend.md) — not repeated here.

## 1. Vitest — the test runner

`web/` builds with **Vite**. Before this phase, there was no test runner at all — no `vitest`, no `jest`, nothing; `npm test` didn't exist as a script.

**Vitest** was picked specifically because the project already uses Vite: Vitest reuses Vite's *same* config, plugins, and TypeScript/JSX transform pipeline instead of needing a second, separately-configured toolchain just for tests (which is what adding Jest here would have meant — Jest doesn't understand Vite's config at all). Its API is close to Jest's on purpose (`describe`, `it`, `expect`, mocking), so nothing about *writing* a test is unfamiliar.

`web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: { "@": path.resolve(__dirname, "./src") },
    },
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/test/setup.ts"],
    },
});
```

It's a near-copy of the existing `vite.config.ts` (same `react()` plugin, same `@` → `./src` alias, so test files can `import` exactly the way app code does), plus a `test` block:
- `environment: "jsdom"` — see §2.
- `globals: true` — lets you write `describe`/`it`/`expect` without importing them in every file (matches how Jest behaves by default).
- `setupFiles` — see §4.

## 2. jsdom — a fake browser for Node

Tests run in Node, not a real browser. But `render(<Button>...)` needs *something* to render a DOM into — a `document`, `window`, etc. jsdom is a JS implementation of browser DOM APIs, running in plain Node, that simulates all of that well enough for component tests to work.

`environment: "jsdom"` in the config above is what turns this on. Without it, `render()` would throw immediately — there'd be no `document` to attach to.

## 3. @testing-library/react + @testing-library/jest-dom

**Testing Library's philosophy:** query the rendered output the way an actual user (or a screen reader) would — by visible text, label, or ARIA role — rather than reaching into component internals or state. That's different from older approaches like Enzyme's shallow rendering, which let you inspect a component's props/internal tree directly. Testing Library treats the component as a black box and asks "what would someone looking at the screen actually see and interact with."

`@testing-library/jest-dom` adds DOM-specific matchers on top of Vitest's built-in `expect` — things like `.toBeInTheDocument()` that don't exist by default.

The one test written so far, `web/src/components/ui/button.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./button";

describe("Button", () => {
    it("renders its children", () => {
        render(<Button>Click me</Button>);
        expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
    });
});
```

`render()` mounts the component into the jsdom DOM. `screen.getByRole("button", { name: "Click me" })` finds it the way a user would — by its accessible role and visible label, not by a test-id or internal prop. `toBeInTheDocument()` is the `jest-dom` matcher from above. This is the template for every future component test.

## 4. `src/test/setup.ts`

```ts
import "@testing-library/jest-dom";
```

One line, one job: register the `jest-dom` matchers globally, once, instead of every single test file having to import this itself. `setupFiles: ["./src/test/setup.ts"]` in the Vitest config is what runs this before any test executes.

## 5. `package.json` additions

```json
"scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
},
"devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "jsdom": "^25.0.1",
    "vitest": "^2.1.8"
}
```

`npm test` runs the whole suite once and exits (`vitest run`, as opposed to Vitest's default interactive watch mode — better for CI and for scripted checks like the pre-commit hook below). `npm run typecheck` runs the TypeScript compiler in check-only mode (`--noEmit`) — same compiler `npm run build` already used, just without producing output, so it's fast to run on every commit.

## 6. Husky — the pre-commit hook

A **git hook** is a script git runs automatically at a specific point — here, `pre-commit`, right before a commit is created. If the script exits non-zero, the commit is blocked. You've likely used one indirectly (e.g. a Prettier/lint-staged setup in another project); this is that same mechanism, built directly.

**Where it lives, and why:** git hooks are repo-wide — there's exactly one `.git` for this whole repo (`api/` and `web/` aren't separate repositories), so there's only ever *one* `pre-commit` script for the whole project, not one per subproject. But `api/` is pure Ruby with no `package.json` to hang an npm tool off of, so Husky (an npm package) has to live somewhere with a Node project — that's `web/`. `web/package.json`:

```json
"scripts": {
    "prepare": "cd .. && husky web/.husky"
},
"devDependencies": {
    "husky": "^9.1.7"
}
```

`npm install` in `web/` automatically runs the `prepare` script. `cd ..` matters: git always runs hooks with its working directory at the **repo root**, not wherever the hook file physically lives — so the hook's target directory (`core.hooksPath`, a git config setting) has to be a path *relative to the repo root* for git to find it later. Running `husky web/.husky` from `web/` itself would register the wrong relative path; running it from the repo root after `cd ..` registers it correctly as `web/.husky`.

The actual hook, `web/.husky/pre-commit`:

```sh
#!/usr/bin/env sh
set -e

if git diff --cached --name-only | grep -q '^api/'; then
  echo "Running API test suite..."
  (cd api && RAILS_ENV=test bundle exec rspec)
fi

if git diff --cached --name-only | grep -q '^web/'; then
  echo "Running web typecheck + tests..."
  (cd web && npm run typecheck && npm test)
fi
```

`git diff --cached --name-only` lists staged files. The script only runs each stack's checks if that stack actually has staged changes — so a `web/`-only commit doesn't pay the cost of spinning up Ruby/RSpec, and vice versa. `set -e` means the script stops (and blocks the commit) the moment any command inside it fails.

One file not worth its own section: `web/package-lock.json` — same thing it always is, npm's exact-version lockfile, regenerated automatically whenever `package.json`'s dependencies change. Nothing new here conceptually, it just didn't exist as a *committed* file before this phase's `npm install`.

## 7. Running it yourself

```bash
cd web
npm install
npm run typecheck
npm test
```

The pre-commit hook itself doesn't need to be run manually — it fires automatically the next time you `git commit`, as long as `npm install` has been run at least once in `web/` (which is what wires up `core.hooksPath`).
