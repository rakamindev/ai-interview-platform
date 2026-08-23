# frozen_string_literal: true

require "rails_helper"

# API-NEW-01: verify_scheme_claim! must actually run (it was previously dead
# code due to before_action ordering across the ApplicationController /
# subclass boundary) and membership revocation must take effect immediately,
# not after the JWT naturally expires.
RSpec.describe "Membership enforcement", type: :request do
  let!(:org) { create(:organization, scheme: "test-corp", host: "test-corp.localhost") }
  let!(:user) { create(:user, email: "admin@test-corp.local", role: "admin") }

  def token_for(user, scheme)
    JsonWebToken.encode(user_id: user.id, role: user.role, scheme: scheme)
  end

  it "rejects a request from a valid JWT with no backing membership row" do
    token = token_for(user, org.scheme)

    get "/api/v1/assessments", headers: { "Authorization" => "Bearer #{token}" }

    expect(response).to have_http_status(:forbidden)
    expect(response.parsed_body.dig("errors", 0, "message")).to match(/no active membership/i)
  end

  it "allows a request once a membership row exists" do
    Membership.create!(user: user, organization: org, role: "admin")
    token = token_for(user, org.scheme)

    get "/api/v1/assessments", headers: { "Authorization" => "Bearer #{token}" }

    expect(response).to have_http_status(:ok)
  end

  it "denies access on the very next request after a membership is revoked, without waiting for JWT expiry" do
    membership = Membership.create!(user: user, organization: org, role: "admin")
    token = token_for(user, org.scheme)

    get "/api/v1/assessments", headers: { "Authorization" => "Bearer #{token}" }
    expect(response).to have_http_status(:ok)

    membership.destroy!

    # Same still-unexpired JWT, no new login — membership alone gates access.
    get "/api/v1/assessments", headers: { "Authorization" => "Bearer #{token}" }
    expect(response).to have_http_status(:forbidden)
  end
end
