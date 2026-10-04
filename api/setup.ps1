$ErrorActionPreference = "Stop"

Write-Host "Waiting for Docker containers to be ready..."
docker compose up -d

Write-Host "Setting up database (create, migrate, seed)..."
docker compose exec api rails db:create db:migrate db:seed

Write-Host "========================================="
Write-Host "Database setup complete! Here is your token:"
Write-Host "========================================="
docker compose exec api rails runner "puts JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: 'test-corp' })"
Write-Host "========================================="
Write-Host "Copy the token above and paste it into web/.env as VITE_DEV_TOKEN."
Write-Host "Then, if you are running the frontend, stop it (Ctrl+C) and run 'npm run dev' again."
