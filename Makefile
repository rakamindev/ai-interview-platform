SHELL := /bin/bash

export PATH := $(HOME)/.rbenv/shims:$(PATH)
export OBJC_DISABLE_INITIALIZE_FORK_SAFETY := YES

.PHONY: help install install-api install-web \
        db-create db-migrate db-seed db-setup \
        services services-start services-stop \
        api sidekiq web dev stop

help:
	@echo "Targets:"
	@echo "  make install        Install API (bundle) and web (npm) dependencies"
	@echo "  make db-setup       Create, migrate and seed the database"
	@echo "  make services       Start Postgres and Redis (brew services)"
	@echo "  make dev            Run API + Sidekiq + web together (Ctrl+C stops all)"
	@echo "  make api            Run only the Rails API server (port 3001)"
	@echo "  make sidekiq        Run only the Sidekiq worker"
	@echo "  make web            Run only the Vite dev server (port 5173)"
	@echo "  make stop           Kill any lingering puma/sidekiq/vite processes"

install: install-api install-web

install-api:
	cd api && bundle install

install-web:
	cd web && npm install

db-create:
	cd api && bundle exec rails db:create

db-migrate:
	cd api && bundle exec rails db:migrate

db-seed:
	cd api && bundle exec rails db:seed

db-setup: db-create db-migrate db-seed

services: services-start

services-start:
	brew services start postgresql@17
	brew services start redis

services-stop:
	brew services stop postgresql@17
	brew services stop redis

api:
	cd api && bundle exec rails server -p 3001

sidekiq:
	cd api && bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml

web:
	cd web && npm run dev

dev:
	@trap 'kill 0' EXIT INT TERM; \
	(cd api && bundle exec rails server -p 3001) & \
	(cd api && bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml) & \
	(cd web && npm run dev) & \
	wait

stop:
	-pkill -f "puma" 2>/dev/null
	-pkill -f "sidekiq" 2>/dev/null
	-pkill -f "vite" 2>/dev/null
	@echo "Stopped."
