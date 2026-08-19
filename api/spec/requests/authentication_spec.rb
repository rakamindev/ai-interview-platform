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
      token = response.parsed_body["token"]
      payload = JsonWebToken.decode(token)

      # Token scheme should match the referer host's org, not the header
      expect(payload[:scheme]).to eq(org.scheme)
    end

    it "falls back to the first org when no referer is present" do
      post "/api/v1/auth/login", params: {
        email: user.email,
        password: "password"
      }

      expect(response).to have_http_status(:ok)
      token = response.parsed_body["token"]
      payload = JsonWebToken.decode(token)

      expect(payload[:scheme]).to be_present
    end
  end

  describe "scheme claim mismatch guard (AC-4.6)" do
    it "rejects when JWT scheme does not match the resolved org" do
      # Mint a token with a different scheme than the resolved org
      foreign_token = JsonWebToken.encode(
        user_id: user.id, role: user.role, scheme: "foreign-corp"
      )

      # Request with the foreign token — middleware resolves org from the JWT scheme
      get "/api/v1/portfolios/1", headers: {
        "Authorization" => "Bearer #{foreign_token}"
      }

      # Should reject because the token's scheme doesn't match any org
      expect(response).to have_http_status(:unauthorized)
    end

    it "allows when JWT scheme matches the resolved org" do
      token = jwt_for(user: user, scheme: org.scheme)

      # The middleware resolves org from the JWT scheme, which matches
      # We can't fully test the happy path without a portfolio,
      # but we can verify the guard doesn't fire on a 404
      get "/api/v1/portfolios/999999", headers: token

      # Should get 404 (not found), not 401 (scheme mismatch)
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "X-Tenant-Scheme header ignored when JWT present (AC-4.7)" do
    it "JWT wins over the header" do
      token = jwt_for(user: user, scheme: org.scheme)

      get "/api/v1/portfolios/999999", headers: token.merge(
        "X-Tenant-Scheme" => "rival-corp"
      )

      # Should get 404 (not found), not 401 (header ignored, JWT scheme used)
      expect(response).to have_http_status(:not_found)
    end
  end
end
