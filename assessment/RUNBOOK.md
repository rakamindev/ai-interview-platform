# Runbook — how to run this and what to check

Everything below assumes Docker Desktop is running. If `docker ps` errors, open Docker Desktop first and wait for the whale icon to stop animating.

---

## 1. Start it

Three terminals' worth of work, but only two commands.

```bash
cd D:/Project/Testing/Rakamin/ai-interview-platform
docker compose up -d
```

That brings up four containers: `db` (PostgreSQL), `redis`, `api` (Rails on :3001) and `sidekiq`. Wait ~20 seconds, then check:

```bash
curl -s http://localhost:3001/health
```

Expect `{"status":"ok"}`.

Then the frontend, in its own terminal (leave it running):

```bash
cd D:/Project/Testing/Rakamin/ai-interview-platform/web
npm run dev
```

Expect `http://localhost:5173/`.

### First time only

If the database is empty (fresh clone, or you removed the `pgdata` volume):

```bash
docker compose exec api bundle exec rails db:create db:migrate db:seed
docker compose exec api bundle exec rails demo:seed
```

`db:seed` creates the organisation and the 22-skill taxonomy. `demo:seed` creates the assessed candidate — without it the portfolio and fit/gap screens have nothing to show. It prints the URLs at the end.

---

## 2. What to look at

Open **http://localhost:5173/assessments/2/sessions/2/fitgap/2**

> The ids are `2` because `demo:reset` was run once. If the page 404s, run `rails demo:seed` again and use the ids it prints.

You should see, in order:

1. A grey banner: **"3 of 7 required skills were not assessed."**
2. A table where the **Required** column has a value on every row — `L4, L3, L4, L3, L3, L3, L2`
3. On *Testing & Quality Assurance*: **`L2  ✎ was L3`** — hover it for the full attribution
4. Three rows reading **Not assessed** in neutral grey, never red
5. A coverage bar, and a legend totalling **7 required skills**
6. A **Culture & Competency Fit** narrative written by Gemini, which says the unassessed skills mean this is not a complete evaluation
7. **Discovered Skills** showing `L3 · medium confidence`

If instead you see the card titled **Summary** with an amber "AI narrative could not be generated" warning, the Gemini call failed — see troubleshooting below. The report is still correct; only the narrative degraded.

Also worth opening: **http://localhost:5173/assessments/2/sessions/2/portfolio** — the *RESTful API Design* card shows a dashed grey **Not rated** badge and a **Set rating** button instead of *Override rating*.

---

## 3. Run the tests

```bash
docker compose exec -e RAILS_ENV=test api bundle exec rspec
```

Expect `54 examples, 0 failures`.

```bash
cd web && npm test
```

Expect `Tests  18 passed (18)`.

If the test database does not exist yet:

```bash
docker compose exec -e RAILS_ENV=test api bundle exec rails db:create db:migrate
```

---

## 4. Troubleshooting

**Everything returns 401, or the app bounces to `/login`.**
The dev JWT is signed with `SECRET_KEY_BASE` from `.env` and expires after 3 days. If you changed that value or the token aged out, mint a new one:

```bash
docker compose exec api bundle exec rails runner "puts JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: 'test-corp' })"
```

Paste it into `web/.env` as `VITE_DEV_TOKEN=…` and restart `npm run dev`.

**The narrative is always the mechanical fallback.**
The configured Gemini model no longer exists for your key. This is quiet by design — the API 404s and the engine degrades rather than failing the report. Check what your key can reach:

```bash
docker compose exec api sh -c 'curl -s -H "x-goog-api-key: $GEMINI_API_KEY" https://generativelanguage.googleapis.com/v1/models | grep -o "\"name\": \"models/[^\"]*\""'
```

Then confirm one actually answers — a model can be listed and still refused:

```bash
docker compose exec api sh -c 'curl -s -o /dev/null -w "%{http_code}\n" -H "x-goog-api-key: $GEMINI_API_KEY" -H "Content-Type: application/json" -d "{\"contents\":[{\"parts\":[{\"text\":\"hi\"}]}]}" https://generativelanguage.googleapis.com/v1/models/gemini-3.6-flash:generateContent'
```

`200` means good. Set `GEMINI_FLASH_MODEL` and `GEMINI_PRO_MODEL` in `.env`, then `docker compose up -d --force-recreate api sidekiq`.

**Vite says the port is taken.** Something is already on 5173. Kill it or run `npx vite --port 5175`, but then add that origin to `ALLOWED_ORIGINS` in `.env` and recreate the api container, or the browser blocks every request with a CORS error.

**`/usr/bin/env: 'ruby\r': No such file or directory`.** Harmless leftover from a Windows checkout; `.gitattributes` fixes it for fresh clones.

---

## 5. Stop it

```bash
docker compose down          # keeps the database
docker compose down -v       # also deletes it — you would need to re-seed
```
