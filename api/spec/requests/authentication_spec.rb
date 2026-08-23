# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Authentication", type: :request do
  let(:org) { create(:organization, scheme: "test-corp", host: "test-corp.localhost") }
  let(:user) { create(:user, email: "admin@test-corp.local", role: "admin") }

  describe "POST /api/v1/auth/login" do
    it "mints a token with the scheme from the referer host, not the header" do
      # Attacker tries to mint a token for a different org via header
      post "/api/v1/auth/login", params: {
        email: user.email,
        password: "password"
      }, headers: {
        "X-Tenant-Scheme" => "rival-corp",
        "Referer" => "http://#{org.host}/"
      }

      expect(response).to have_http_status(:ok)
      token = response.parsed_body["access_token"]
      payload = JsonWebToken.decode(token)

      # Token scheme should match the referer host's org, not the header
      expect(payload[:scheme]).to eq(org.scheme)
    end

    it "returns 422 tenant_unresolved when no referer is present" do
      post "/api/v1/auth/login", params: {
        email: user.email,
        password: "password"
      }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body["errors"][0]["code"]).to eq("tenant_unresolved")
    end

    it "allows a role: user account to log in (API-FIX-01)" do
      candidate_user = create(:user, :candidate, email: "regular@test-corp.local")

      post "/api/v1/auth/login", params: {
        email: candidate_user.email,
        password: "password"
      }, headers: {
        "Referer" => "http://#{org.host}/"
      }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["access_token"]).to be_present
    end
  end

  describe "POST /api/v1/auth/refresh" do
    it "returns 422 tenant_unresolved when referer cannot resolve org" do
      # Login with a valid referer to get a refresh token
      post "/api/v1/auth/login", params: {
        email: user.email,
        password: "password"
      }, headers: {
        "Referer" => "http://#{org.host}/"
      }
      expect(response).to have_http_status(:ok)

      rt = response.headers["Set-Cookie"].to_s.match(/refresh_token=([a-f0-9]+)/)&.captures&.first
      csrf = response.headers["Set-Cookie"].to_s.match(/csrf_secret=([a-f0-9]+)/)&.captures&.first
      expect(rt).to be_present
      expect(csrf).to be_present

      # Refresh WITHOUT a referer — should fail with 422
      cookie_header = "refresh_token=#{rt}; csrf_secret=#{csrf}"
      post "/api/v1/auth/refresh",
           headers: {
             "X-CSRF-Token" => csrf,
             "Cookie" => cookie_header
           }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body["errors"][0]["code"]).to eq("tenant_unresolved")
    end
  end

  describe "scheme claim mismatch guard (AC-4.6)" do
    it "rejects when JWT scheme does not match the resolved org" do
      # Mint a token with a different scheme than the resolved org
      foreign_token = JsonWebToken.encode(
        user_id: user.id, role: user.role, scheme: "foreign-corp"
      )

      # Request with the foreign token — middleware resolves org from the JWT scheme
      get "/api/v1/assessments/1", headers: {
        "Authorization" => "Bearer #{foreign_token}"
      }

      # "foreign-corp" resolves to no org at all, so this actually hits
      # require_tenant! (TenantNotFound), not verify_scheme_claim! directly —
      # both map to 403 by design (exception_handler.rb), not 401.
      expect(response).to have_http_status(:forbidden)
    end

    it "allows when JWT scheme matches the resolved org" do
      token = jwt_for(user: user, scheme: org.scheme)

      # The middleware resolves org from the JWT scheme, which matches
      # We can't fully test the happy path without a portfolio,
      # but we can verify the guard doesn't fire on a 404
      get "/api/v1/assessments/999999", headers: token

      # Should get 404 (not found), not 401 (scheme mismatch)
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "X-Tenant-Scheme header ignored when JWT present (AC-4.7)" do
    it "JWT wins over the header" do
      token = jwt_for(user: user, scheme: org.scheme)

      get "/api/v1/assessments/999999", headers: token.merge(
        "X-Tenant-Scheme" => "rival-corp"
      )

      # Should get 404 (not found), not 401 (header ignored, JWT scheme used)
      expect(response).to have_http_status(:not_found)
    end
  end
end
