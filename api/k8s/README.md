# ai-interview Kubernetes manifests

Deploy manifests for the `ai-interview-api` service (Rails + Puma + WebSocket) and
`ai-interview-sidekiq`. Secrets are **never** baked into images or committed to the
repo — they are injected at runtime from a `Secret` (see `secret.example.yaml`).

## Before you apply

1. **Rotate credentials** (one-time, infra action): the Groq key and DB password in
   the local `api/config/application.yml` are treated as compromised (OPS-1).
   Rotate before any real deploy; `api/.dockerignore` keeps them out of images from
   now on.
2. **Edit the two infra-specific values** in `configmap.yaml`:
   - `DB_HOST` — the shared PostgreSQL endpoint (must match `rakamin-api`'s DB)
   - `ALLOWED_ORIGINS` — comma-separated frontend origin(s) for CORS
3. **Create the real Secret** from the template (never apply the example as-is):

   ```bash
   cp secret.example.yaml secret.yaml
   # replace each base64 value: printf %s 'real-value' | base64
   kubectl apply -f secret.yaml
   ```

## Apply order

```bash
kubectl apply -f secret.yaml          # real credentials (from step 3 above)
kubectl apply -f redis.yaml           # in-cluster Redis (or point REDIS_URL at managed Redis)
kubectl apply -f configmap.yaml       # non-secret config
kubectl apply -f deployment.yaml      # API (replicas: 2 — needs ≥2 nodes in paragon-t2d-tau-pool)
kubectl apply -f deploy-sidekiq.yaml  # workers
kubectl apply -f pdb.yaml             # PodDisruptionBudget (api + sidekiq)
```

For a **migration + release** (requires the migration Job + a SHA-tagged image):

```bash
# 1. Run migrations as a Job, wait for completion
kubectl apply -f migration-job.yaml
kubectl wait --for=condition=complete job/ai-interview-migrate --timeout=300s

# 2. Roll out the new image by tag (immutable — never reuse `latest` in prod)
kubectl set image deployment/ai-interview-api      ai-interview-api=asia-southeast2-docker.pkg.dev/rakamin-poc/rakamin-images/ai-interview-api:<SHA>
kubectl set image deployment/ai-interview-sidekiq  ai-interview-sidekiq=asia-southeast2-docker.pkg.dev/rakamin-poc/rakamin-images/ai-interview-api:<SHA>
kubectl rollout status deployment/ai-interview-api      --timeout=300s
kubectl rollout status deployment/ai-interview-sidekiq  --timeout=300s
```

The CI/CD pipeline (`.github/workflows/deploy.yml`) automates exactly this sequence on
production — migration Job first, then `set image`, then rollout status — with the image
tagged by git SHA. **Rollback** to a previous release: re-run `kubectl set image` with the
previous `<SHA>` (keep the last-known-good SHA handy; `kubectl rollout history deployment/ai-interview-api`
lists prior revisions and their `change-cause`).

The API and Sidekiq deployments load both the ConfigMap and the `ai-interview-secrets`
Secret via `envFrom`. `DB_USERNAME`, `DB_PASSWORD`, `SECRET_KEY_BASE`, and
`GEMINI_API_KEY` come from the Secret; `REDIS_URL` and models/URLs come from the
ConfigMap. `SENTRY_DSN` (optional) comes from the Secret — the app no-ops when absent.

## Redis options

- **In-cluster (default template):** `redis.yaml` — a `redis:7-alpine` pod exposed
  only inside the cluster (`ai-interview-redis:6379`), no auth. Data is ephemeral
  (`emptyDir`) — fine for a POC, not durable.
- **Managed (production):** provision Memorystore/ElastiCache, then either update
  `REDIS_URL` in the ConfigMap (no auth) or move it into the Secret (auth'd
  instances). No other manifest changes required.

## Manual checks after rollout

- API pod is `Ready` (startup probe hits `/health`, readiness probe hits
  `/health/ready` — verifies PostgreSQL + Redis before serving traffic), Sidekiq
  pod readiness greps `tmp/sidekiq_status`.
- Both API replicas are `Running` and spread across distinct nodes
  (`kubectl get pods -o wide` — required podAntiAffinity enforces 1 pod/node).
- `RAILS_ENV=production` on both; Sidekiq runs `-e production`
  (`config/environments/production.rb` exists — no more `staging` flag).
- `OTEL_SERVICE_NAME` is `ai-interview-api-production` / `ai-interview-sidekiq-production`.

## Handoffs (infra, not code)

- Rotate leaked Groq key + DB password (OPS-1).
- Choose the secret backend (plain Secret vs ExternalSecrets/SealedSecrets) and
  managed Redis (OPS-2).
- CI/CD, observability, HA, migration jobs: tracked in the `ci-and-observability`
  change (OPS-5/OPS-6) — implemented in `.github/workflows/ci.yml`,
  `.github/workflows/deploy.yml`, `migration-job.yaml`, `pdb.yaml`.