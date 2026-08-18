#!/usr/bin/env bash
set -e

bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml &
SIDEKIQ_PID=$!

trap "kill -TERM $SIDEKIQ_PID 2>/dev/null" EXIT

exec bundle exec puma -C config/puma.rb
