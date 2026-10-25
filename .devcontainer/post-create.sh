#!/usr/bin/env bash
# Runs once when the devcontainer is created. Installs deps for both
# services and prepares the database. Safe to re-run manually.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Installing API gems"
(cd api && bundle install)

echo "==> Installing web dependencies"
(cd web && npm install)

if [ ! -f web/.env ]; then
    echo "==> Writing web/.env for the devcontainer"
    cat > web/.env <<'EOF'
# Generated for the devcontainer by .devcontainer/post-create.sh.
# The values below match .devcontainer/docker-compose.yml.
VITE_API_BASE_URL=http://localhost:3001/api/v1
VITE_WS_BASE_URL=ws://localhost:3001

# Mint a JWT after seeding (see instructions printed below) and paste it here.
VITE_DEV_TOKEN=

VITE_DEV_TENANT_ID=1
VITE_DEV_TENANT_NAME=Demo Tenant
EOF
fi

echo "==> Waiting for Postgres"
until pg_isready -h db -p 5432 -U postgres >/dev/null 2>&1; do
    sleep 1
done

echo "==> Preparing database"
(cd api && bundle exec rails db:create db:migrate db:seed)

cat <<'EOF'

==> Setup complete.

Start everything at once:
  bash .devcontainer/dev.sh

...or run each service in its own terminal:
  cd api && bundle exec rails server -b 0.0.0.0 -p 3001
  cd api && bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml
  cd web && npm run dev -- --host 0.0.0.0

The seed output above printed a Rails console snippet to mint a JWT
(JsonWebToken.encode(...)) — paste it into web/.env as VITE_DEV_TOKEN.

App URLs (forwarded to your host):
  Web  http://localhost:5173
  API  http://localhost:3001
EOF
