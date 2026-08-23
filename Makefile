.PHONY: help check check-api-env check-web-env api-up api-down api-nuke api-build api-logs api-ps api-test api-console api-seed web-up web-down web-nuke web-build web-logs web-ps web-test web-lint web-lint-fix web-fmt web-fmt-check web-prod web-prod-up web-prod-down up down nuke build logs ps test lint fmt

API := docker compose -f api/docker-compose.yml
WEB := docker compose -f web/docker-compose.yml

# ─── Env / config checks ────────────────────────────────────────────
# Run `make NO_CHECK=1 <target>` to bypass checks (e.g. `make NO_CHECK=1 down`)

check-api-env:
ifndef NO_CHECK
	@test -f api/config/application.yml || \
		{ echo "ERROR: api/config/application.yml not found" >&2; \
		  echo "  Fix:  cp api/config/application.yml.sample api/config/application.yml" >&2; \
		  exit 1; }
	@# Reject placeholder sentinels only when stub mode is OFF
	@STUB=$$(awk -F: '/^[[:space:]]*GEMINI_STUB:/{gsub(/[ "\x27]/,"",$$2); print $$2}' api/config/application.yml); \
	 STUB=$${STUB:-true}; \
	 if [ "$$STUB" != "true" ]; then \
	   BAD=""; \
	   awk -F: '/^[[:space:]]*SECRET_KEY_BASE:/{gsub(/[ "\x27]/,"",$$2); print $$2}' api/config/application.yml | grep -q "your_secret_key_base_here" && BAD="SECRET_KEY_BASE"; \
	   awk -F: '/^[[:space:]]*GEMINI_API_KEY:/{gsub(/[ "\x27]/,"",$$2); print $$2}' api/config/application.yml | grep -q "your_gemini_api_key" && BAD="$$BAD GEMINI_API_KEY"; \
	   if [ -n "$$BAD" ]; then \
	     echo "ERROR: api/config/application.yml has placeholder values($$BAD) while GEMINI_STUB is off" >&2; \
	     echo "  Fix: set real values or enable stub mode (GEMINI_STUB: \"true\")" >&2; \
	     exit 1; \
	   fi; \
	 fi
endif

check-web-env:
ifndef NO_CHECK
	@test -f web/.env || \
		{ echo "ERROR: web/.env not found" >&2; \
		  echo "  Fix:  cp web/.env.example web/.env" >&2; \
		  exit 1; }
endif

# ─── API targets ─────────────────────────────────────────────────────

api-up: check-api-env
	$(API) up -d

api-down: check-api-env
	$(API) down

api-nuke: check-api-env
	$(API) down -v

api-build: check-api-env
	$(API) up -d --build

api-logs: check-api-env
	$(API) logs -f

api-ps: check-api-env
	$(API) ps

api-test: check-api-env
	$(API) exec -e RAILS_ENV=test -e DB_NAME=rakamin_test -e GEMINI_STUB=true api bundle exec rails db:create db:force_migrate
	$(API) exec -e RAILS_ENV=test -e DB_NAME=rakamin_test -e GEMINI_STUB=true api bundle exec rspec

api-console: check-api-env
	$(API) exec api bundle exec rails c

api-seed: check-api-env
	$(API) exec api bundle exec rails db:seed:replant

# ─── Web targets ─────────────────────────────────────────────────────

web-up: check-web-env
	$(WEB) up -d

web-down: check-web-env
	$(WEB) down

web-nuke: check-web-env
	$(WEB) down -v

web-build: check-web-env
	$(WEB) up -d --build

web-logs: check-web-env
	$(WEB) logs -f

web-ps: check-web-env
	$(WEB) ps

web-test: check-web-env
	$(WEB) exec web npm run test

web-lint:
	cd web && npm run lint

web-lint-fix:
	cd web && npm run lint:fix

web-fmt:
	cd web && npm run fmt

web-fmt-check:
	cd web && npm run fmt:check

web-prod:
	$(WEB) build web-prod

web-prod-up: check-web-env
	$(WEB) up -d web-prod

web-prod-down: check-web-env
	$(WEB) down web-prod

# ─── Both ────────────────────────────────────────────────────────────

up: api-up web-up

down: api-down web-down

nuke: api-nuke web-nuke

build: api-build web-build

logs: api-logs web-logs

ps: api-ps web-ps

test: api-test web-test

lint: web-lint

fmt: web-fmt

# ─── Utilities ───────────────────────────────────────────────────────

check: check-api-env check-web-env
	@echo "OK: all config checks passed"

help:
	@grep -E '^[a-zA-Z_-]+:' $(MAKEFILE_LIST) | sed 's/:.*//' | grep -v '.PHONY' | sort --unique
