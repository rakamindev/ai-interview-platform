# 01-dual-layer-invite-resolution

Status: done
Blocked by: none

## Context
Candidate invite links historically directed to port 3001 (the Rails API host), causing candidates to receive an immediate HTTP 404 RoutingError.

## Implementation Details
1. Update `Session#invite_url` in `api/app/models/session.rb` to resolve using `ENV.fetch('WEB_BASE_URL', 'http://localhost:5173')` (or `WEB_APP_BASE_URL`).
2. Add a redirect route in `api/config/routes.rb`:
   `get '/interview/:token', to: redirect { |params, req| "#{ENV.fetch('WEB_BASE_URL', 'http://localhost:5173')}/interview/#{params[:token]}" }`
3. Add a request spec in `api/spec/requests/api/v1/sessions_spec.rb` or routes test verifying:
   - `session.invite_url` contains the web host.
   - Requesting `GET /interview/:token` on Rails API returns HTTP 301/302 redirecting to `http://localhost:5173/interview/:token`.

## Verification
- `cd api && bundle exec rspec spec/requests/api/v1/sessions_spec.rb`
