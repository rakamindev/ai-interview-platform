#!/usr/bin/env bash
# Runs the API, Sidekiq worker, and web dev server together in one terminal.
# Ctrl-C stops all three.
set -e
cd "$(dirname "$0")/.."

trap 'kill 0' EXIT

(cd api && bundle exec rails server -b 0.0.0.0 -p 3001) &
(cd api && bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml) &
(cd web && npm run dev -- --host 0.0.0.0 --port 5173) &

wait
