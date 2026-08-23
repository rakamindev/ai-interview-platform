# 13 — Deployment

**Provenance: `[CODE]`.**

Production gaps: k8s ConfigMap leaks secrets, COPY . . in Dockerfile, missing health checks, scaling ceiling.

---

## 1. Current Deployment Architecture

```
GKE Cluster
  |
  +-- paragon-t2d-tau-pool (dedicated node pool)
       |
       +-- Node 1: ai-interview-api (1 pod) + ai-interview-sidekiq (1 pod)
       +-- Node 2: (reserved for scaling)
```

### Components

| Component | Image | Replicas | Resources |
|-----------|-------|----------|-----------|
| API | `asia-southeast2-docker.pkg.dev/rakamin-poc/rakamin-images/ai-interview-api:latest` | 1 | 500m-2000m CPU, 512Mi-2Gi memory |
| Sidekiq | Same image | 1 | 200m-1000m CPU, 512Mi-1536Mi memory |

### Node Strategy

- `nodeSelector`: pods only land on `paragon-t2d-tau-pool` nodes
- `podAntiAffinity` (required): at most 1 API pod per node
- `podAffinity` (required): Sidekiq follows API pods (1:1 pairing)
- `terminationGracePeriodSeconds`: 90s for API (WebSocket drain), 60s for Sidekiq

---

## 2. Production Gaps

### Gap 1: ConfigMap Leaks Secrets

`api/k8s/configmap.yaml`:

```yaml
data:
  DB_HOST: "<your-db-host>"
  DB_NAME: "<your-db-name>"
  GEMINI_API_KEY: (not in configmap, but could be added)
```

The ConfigMap is committed to version control with placeholder values. If real values are added, they are visible to anyone with repo access.

**Fix:** Use Kubernetes Secrets for sensitive values. Move DB credentials and API keys to a Secret resource.

### Gap 2: COPY . . in Dockerfile

`api/Dockerfile:36`:

```dockerfile
COPY . .
```

This copies everything — including `.env`, `config/master.key`, `tmp/`, `log/`, `.git/` — into the production image.

**Fix:** Use a `.dockerignore` file (added in Wave 0) to exclude sensitive files. Verify `.dockerignore` is comprehensive.

### Gap 3: No Health Check Implementation Verified

`api/k8s/deployment.yaml:99-121` configures health checks on `/health`:

```yaml
startupProbe:
  httpGet:
    path: /health
    port: 3001
```

The health endpoint implementation was not verified in the codebase exploration. If it does not exist or does not work correctly, Kubernetes will restart pods unnecessarily.

**Fix:** Verify `/health` endpoint exists and returns 200 on healthy state.

### Gap 4: Scaling Ceiling

The dedicated node pool with `podAntiAffinity: required` means 1 API pod per node. To scale to N pods, you need N nodes.

```yaml
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels:
            app: ai-interview-api
        topologyKey: kubernetes.io/hostname
```

This is a deliberate design choice (EventMachine WebSocket requires single-process per node), but it limits horizontal scaling.

**Fix:** Document the scaling model. Consider connection pooling or WebSocket externalization for higher scale.

### Gap 5: No Pod Disruption Budget

No PDB defined. During node upgrades or maintenance, both API and Sidekiq pods could be evicted simultaneously.

**Fix:** Create PodDisruptionBudget with `minAvailable: 1` for both API and Sidekiq.

### Gap 6: No Horizontal Pod Autoscaler

No HPA configured. Scaling is manual via `kubectl scale`.

**Fix:** Add HPA based on CPU/memory utilization or custom metrics (WebSocket connections, queue depth).

### Gap 7: Sidekiq Hardcoded to staging

`api/k8s/deploy-sidekiq.yaml:61`:

```yaml
args: ["exec", "sidekiq", "-e", "staging"]
```

Sidekiq is hardcoded to `staging` environment, not `production`.

**Fix:** Use ConfigMap or environment variable to set the correct environment.

### Gap 8: No Ingress TLS Termination Verified

`api/k8s/ingress.yml` exists but TLS configuration was not verified.

**Fix:** Verify TLS certificates are configured and auto-renewed (e.g., via cert-manager).

### Gap 9: No Network Policy

No NetworkPolicy defined. Any pod in the cluster can communicate with the API and database.

**Fix:** Add NetworkPolicy to restrict traffic to only required sources.

### Gap 10: No Resource Quotas

No ResourceQuota or LimitRange defined. Pods can consume unbounded resources.

**Fix:** Add ResourceQuota for the namespace and LimitRange for pod defaults.

---

## 3. Scaling Model

Current model: 1 API pod + 1 Sidekiq pod per node.

To scale:
```bash
kubectl scale deployment ai-interview-api --replicas=N
kubectl scale deployment ai-interview-sidekiq --replicas=N
```

Requirements:
- N nodes in `paragon-t2d-tau-pool`
- Each node must have the toleration for `paragon-compute-class-tau-nodepool`
- Sidekiq must be co-located with API (podAffinity)

Bottleneck: EventMachine WebSocket connections are in-process. Each pod handles up to ~100 concurrent WebSocket connections. Beyond that, consider:
- WebSocket externalization (e.g., Action Cable with Redis adapter)
- Connection pooling
- Geographic distribution

---

## 4. Deployment Checklist

- [ ] Move secrets to Kubernetes Secrets
- [ ] Verify `.dockerignore` excludes sensitive files
- [ ] Verify `/health` endpoint implementation
- [ ] Fix Sidekiq environment (staging → production)
- [ ] Add PodDisruptionBudget
- [ ] Add HorizontalPodAutoscaler
- [ ] Add NetworkPolicy
- [ ] Add ResourceQuota
- [ ] Verify TLS configuration
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation
- [ ] Set up backup strategy for PostgreSQL
