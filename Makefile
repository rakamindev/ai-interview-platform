SHELL := /bin/bash
.DEFAULT_GOAL := help

RUBY_VERSION    := $(shell cat api/.ruby-version 2>/dev/null)
NODE_MIN        := 18

PG_CONTAINER    := ai-interview-pg
PG_IMAGE        := docker.io/library/postgres:16-alpine
PG_VOLUME       := ai-interview-pgdata
PG_PORT         := 5432

REDIS_CONTAINER := ai-interview-redis
REDIS_IMAGE     := docker.io/library/redis:7-alpine
REDIS_PORT      := 6379

DB_USER         := postgres
DB_PASSWORD     := postgres
DB_NAME         := rakamin_development

API_PORT        := 3001
WEB_PORT        := 5173

API_CONFIG      := api/config/application.yml
WEB_ENV         := web/.env

# Tenant scheme created by db/seeds.rb
DEV_SCHEME      := test-corp

.PHONY: help doctor ruby config install services services-up services-down \
        services-restart services-status services-logs db db-reset db-console \
        redis-console setup api worker web dev token test test-api test-web \
        clean clean-all

help:
	@echo "AI Interview Platform"
	@echo ""
	@echo "  Setup"
	@echo "    make doctor           check prerequisites without changing anything"
	@echo "    make setup            full first-time setup (ruby, config, containers, deps, database)"
	@echo "    make ruby             install Ruby $(RUBY_VERSION) via rbenv"
	@echo "    make config           write api/config/application.yml and web/.env if missing"
	@echo "    make install          bundle install and npm install"
	@echo ""
	@echo "  Containers (podman)"
	@echo "    make services         start PostgreSQL and Redis, wait until both answer"
	@echo "    make services-down    stop and remove both containers"
	@echo "    make services-status  show container status"
	@echo "    make services-logs    tail both container logs"
	@echo ""
	@echo "  Database"
	@echo "    make db               create, migrate and seed"
	@echo "    make db-reset         drop and rebuild from scratch"
	@echo "    make db-console       psql inside the postgres container"
	@echo ""
	@echo "  Run"
	@echo "    make dev              API + Sidekiq + web in one terminal"
	@echo "    make api              API only          (port $(API_PORT))"
	@echo "    make worker           Sidekiq only"
	@echo "    make web              web app only      (port $(WEB_PORT))"
	@echo "    make token            mint a dev JWT and write it into web/.env"
	@echo ""
	@echo "  Test"
	@echo "    make test             run every suite that exists"
	@echo "    make test-api         rspec"
	@echo "    make test-web         vitest"

# ── Prerequisites ────────────────────────────────────────────────────────────

doctor:
	@echo "Checking prerequisites"
	@ok=1; \
	if command -v podman >/dev/null 2>&1; then \
	  echo "  podman     $$(podman -v)"; \
	else \
	  echo "  podman     MISSING - install podman first"; ok=0; \
	fi; \
	if command -v rbenv >/dev/null 2>&1; then \
	  echo "  rbenv      $$(rbenv -v)"; \
	else \
	  echo "  rbenv      MISSING - Ruby $(RUBY_VERSION) is pinned by api/.ruby-version"; ok=0; \
	fi; \
	if rbenv versions --bare 2>/dev/null | grep -qx "$(RUBY_VERSION)"; then \
	  echo "  ruby       $(RUBY_VERSION) installed"; \
	else \
	  echo "  ruby       $(RUBY_VERSION) NOT installed - run: make ruby"; ok=0; \
	fi; \
	if command -v node >/dev/null 2>&1; then \
	  echo "  node       $$(node -v)"; \
	else \
	  echo "  node       MISSING - need Node $(NODE_MIN) or newer"; ok=0; \
	fi; \
	if [ -f "$(API_CONFIG)" ]; then \
	  echo "  api config $(API_CONFIG) present"; \
	  if grep -q 'REPLACE_WITH_YOUR_GEMINI_API_KEY' "$(API_CONFIG)"; then \
	    echo "             GEMINI_API_KEY is still a placeholder - a live interview will not start"; ok=0; \
	  fi; \
	else \
	  echo "  api config MISSING - run: make config"; ok=0; \
	fi; \
	if [ -f "$(WEB_ENV)" ]; then \
	  echo "  web env    $(WEB_ENV) present"; \
	else \
	  echo "  web env    MISSING - run: make config"; ok=0; \
	fi; \
	echo ""; \
	if [ $$ok -eq 1 ]; then echo "All prerequisites satisfied."; else echo "Fix the items above, then re-run make doctor."; fi

ruby:
	@if rbenv versions --bare 2>/dev/null | grep -qx "$(RUBY_VERSION)"; then \
	  echo "Ruby $(RUBY_VERSION) already installed."; \
	else \
	  echo "Installing Ruby $(RUBY_VERSION) via rbenv. This compiles from source and takes several minutes."; \
	  rbenv install $(RUBY_VERSION); \
	  rbenv rehash; \
	fi
	@cd api && ruby -v

# ── Configuration ────────────────────────────────────────────────────────────

config: $(API_CONFIG) $(WEB_ENV)

$(API_CONFIG):
	@echo "Writing $(API_CONFIG)"
	@printf '%s\n' \
	  'SECRET_KEY_BASE: "'"$$(openssl rand -hex 64)"'"' \
	  '' \
	  'DB_HOST: "localhost"' \
	  'DB_PORT: "$(PG_PORT)"' \
	  'DB_NAME: "$(DB_NAME)"' \
	  'DB_USERNAME: "$(DB_USER)"' \
	  'DB_PASSWORD: "$(DB_PASSWORD)"' \
	  '' \
	  'GEMINI_API_KEY: "REPLACE_WITH_YOUR_GEMINI_API_KEY"' \
	  '' \
	  'GEMINI_LIVE_MODEL: "gemini-3.1-flash-live-preview"' \
	  'GEMINI_FLASH_MODEL: "gemini-3.1-flash-lite"' \
	  'GEMINI_PRO_MODEL: "gemini-3.7-flash"' \
	  '' \
	  'APP_BASE_URL: "http://localhost:$(API_PORT)"' \
	  'ALLOWED_ORIGINS: "http://localhost:$(WEB_PORT)"' \
	  'TOKEN_EXPIRATION_TIME: "259200"' \
	  'REDIS_URL: "redis://localhost:$(REDIS_PORT)/1"' \
	  > $(API_CONFIG)
	@echo "  GEMINI_API_KEY is a placeholder. Edit $(API_CONFIG) before make dev."

$(WEB_ENV):
	@echo "Writing $(WEB_ENV)"
	@printf '%s\n' \
	  'VITE_API_BASE_URL=http://localhost:$(API_PORT)/api/v1' \
	  'VITE_WS_BASE_URL=ws://localhost:$(API_PORT)' \
	  'VITE_DEV_TOKEN=' \
	  'VITE_DEV_TENANT_ID=1' \
	  'VITE_DEV_TENANT_NAME=Test Corp' \
	  'VITE_SPEED_TEST_PING_URL=' \
	  'VITE_SPEED_TEST_UPLOAD_URL=' \
	  > $(WEB_ENV)
	@echo "  VITE_DEV_TOKEN is empty. Run make token once the database is seeded."

# ── Dependencies ─────────────────────────────────────────────────────────────

install:
	@echo "Installing Ruby gems"
	@cd api && bundle install
	@echo "Installing npm packages"
	@cd web && npm install

# ── Containers ───────────────────────────────────────────────────────────────

services: services-up

services-up:
	@if [ -z "$$(podman ps -q -f name=^$(PG_CONTAINER)$$)" ]; then \
	  if [ -n "$$(podman ps -aq -f name=^$(PG_CONTAINER)$$)" ]; then \
	    echo "Starting existing $(PG_CONTAINER)"; podman start $(PG_CONTAINER) >/dev/null; \
	  else \
	    echo "Creating $(PG_CONTAINER) from $(PG_IMAGE)"; \
	    podman run -d --name $(PG_CONTAINER) \
	      -e POSTGRES_USER=$(DB_USER) \
	      -e POSTGRES_PASSWORD=$(DB_PASSWORD) \
	      -e POSTGRES_DB=$(DB_NAME) \
	      -p $(PG_PORT):5432 \
	      -v $(PG_VOLUME):/var/lib/postgresql/data \
	      $(PG_IMAGE) >/dev/null; \
	  fi; \
	else \
	  echo "$(PG_CONTAINER) already running"; \
	fi
	@if [ -z "$$(podman ps -q -f name=^$(REDIS_CONTAINER)$$)" ]; then \
	  if [ -n "$$(podman ps -aq -f name=^$(REDIS_CONTAINER)$$)" ]; then \
	    echo "Starting existing $(REDIS_CONTAINER)"; podman start $(REDIS_CONTAINER) >/dev/null; \
	  else \
	    echo "Creating $(REDIS_CONTAINER) from $(REDIS_IMAGE)"; \
	    podman run -d --name $(REDIS_CONTAINER) \
	      -p $(REDIS_PORT):6379 \
	      $(REDIS_IMAGE) >/dev/null; \
	  fi; \
	else \
	  echo "$(REDIS_CONTAINER) already running"; \
	fi
	@printf "Waiting for PostgreSQL "
	@for i in $$(seq 1 60); do \
	  if podman exec $(PG_CONTAINER) pg_isready -U $(DB_USER) >/dev/null 2>&1; then echo " ready"; break; fi; \
	  printf "."; sleep 1; \
	  if [ $$i -eq 60 ]; then echo " TIMEOUT"; exit 1; fi; \
	done
	@printf "Waiting for Redis "
	@for i in $$(seq 1 30); do \
	  if [ "$$(podman exec $(REDIS_CONTAINER) redis-cli ping 2>/dev/null)" = "PONG" ]; then echo " ready"; break; fi; \
	  printf "."; sleep 1; \
	  if [ $$i -eq 30 ]; then echo " TIMEOUT"; exit 1; fi; \
	done

services-down:
	-@podman stop $(PG_CONTAINER) $(REDIS_CONTAINER) 2>/dev/null
	-@podman rm $(PG_CONTAINER) $(REDIS_CONTAINER) 2>/dev/null
	@echo "Containers removed. The $(PG_VOLUME) volume still holds your data."

services-restart: services-down services-up

services-status:
	@podman ps -a --filter name=$(PG_CONTAINER) --filter name=$(REDIS_CONTAINER) \
	  --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

services-logs:
	@podman logs -f --tail 50 $(PG_CONTAINER) & \
	 podman logs -f --tail 50 $(REDIS_CONTAINER) & \
	 wait

# ── Database ─────────────────────────────────────────────────────────────────

db: services
	@cd api && bundle exec rails db:create db:migrate db:seed

db-reset: services
	@cd api && bundle exec rails db:drop db:create db:migrate db:seed

db-console:
	@podman exec -it $(PG_CONTAINER) psql -U $(DB_USER) -d $(DB_NAME)

redis-console:
	@podman exec -it $(REDIS_CONTAINER) redis-cli

# ── First-time setup ─────────────────────────────────────────────────────────

setup: ruby config install services db
	@echo ""
	@echo "Setup finished. Two things left:"
	@echo "  1. Put a real key in GEMINI_API_KEY inside $(API_CONFIG)"
	@echo "  2. Run: make token   (mints a JWT so the web app can call the API)"
	@echo ""
	@echo "Then: make dev"

# ── Run ──────────────────────────────────────────────────────────────────────

api: services
	@cd api && bundle exec rails server -p $(API_PORT)

worker: services
	@cd api && bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml

web:
	@cd web && npm run dev

dev: services
	@echo "API      http://localhost:$(API_PORT)"
	@echo "Web      http://localhost:$(WEB_PORT)"
	@echo "Ctrl-C stops all three."
	@echo ""
	@trap 'kill 0' EXIT INT TERM; \
	( cd api && bundle exec rails server -p $(API_PORT) 2>&1 | sed 's/^/[api]    /' ) & \
	( cd api && bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml 2>&1 | sed 's/^/[worker] /' ) & \
	( cd web && npm run dev 2>&1 | sed 's/^/[web]    /' ) & \
	wait

token:
	@cd api && bundle exec rails runner \
	  'puts JsonWebToken.encode({ user_id: 1, role: "admin", scheme: "$(DEV_SCHEME)" })' \
	  2>/dev/null | tail -1 > /tmp/ai-interview-token
	@token=$$(cat /tmp/ai-interview-token); \
	if [ -z "$$token" ]; then echo "Failed to mint a token. Is the database seeded? Try: make db"; exit 1; fi; \
	if grep -q '^VITE_DEV_TOKEN=' $(WEB_ENV); then \
	  sed -i "s|^VITE_DEV_TOKEN=.*|VITE_DEV_TOKEN=$$token|" $(WEB_ENV); \
	else \
	  echo "VITE_DEV_TOKEN=$$token" >> $(WEB_ENV); \
	fi; \
	echo "Wrote VITE_DEV_TOKEN into $(WEB_ENV)"; \
	echo "$$token"
	@rm -f /tmp/ai-interview-token
	@echo "Restart the web dev server so Vite picks up the new value."

# ── Test ─────────────────────────────────────────────────────────────────────

test: test-api test-web

test-api: services
	@if [ -d api/spec ]; then \
	  cd api && bundle exec rspec; \
	else \
	  echo "api/spec does not exist yet. No RSpec suite to run."; \
	fi

test-web:
	@if grep -q '"test"' web/package.json; then \
	  cd web && npm test; \
	else \
	  echo "web/package.json has no test script yet. No web suite to run."; \
	fi

# ── Cleanup ──────────────────────────────────────────────────────────────────

clean: services-down

clean-all: services-down
	-@podman volume rm $(PG_VOLUME) 2>/dev/null
	@echo "Removed the $(PG_VOLUME) volume. All database data is gone."
