# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Login throttling", type: :request do
  let(:organization) { create(:organization) }
  let(:tenant) { { "X-Tenant-Scheme" => organization.scheme } }

  before do
    Rack::Attack.enabled = true
    Rack::Attack.cache.store.clear
  end

  after { Rack::Attack.enabled = false }

  def attempt(email, ip:, json: true)
    if json
      post "/api/v1/auth/login", params: { email: email, password: "wrong" }.to_json,
                                 headers: tenant.merge("Content-Type" => "application/json", "REMOTE_ADDR" => ip)
    else
      post "/api/v1/auth/login", params: { email: email, password: "wrong" },
                                 headers: tenant.merge("REMOTE_ADDR" => ip)
    end
  end

  it "throttles repeated attempts against one account even when each comes from a different IP" do
    10.times { |i| attempt("victim@example.com", ip: "10.0.0.#{i + 1}") }
    expect(response).not_to have_http_status(:too_many_requests)

    attempt("victim@example.com", ip: "10.0.1.1")

    expect(response).to have_http_status(:too_many_requests)
  end

  it "counts the account case-insensitively and for form-encoded bodies too" do
    5.times { |i| attempt("Victim@Example.com", ip: "10.0.2.#{i}", json: false) }
    5.times { |i| attempt("victim@example.com", ip: "10.0.3.#{i}") }

    attempt("VICTIM@example.com", ip: "10.0.4.1")

    expect(response).to have_http_status(:too_many_requests)
  end

  it "does not throttle a different account" do
    10.times { |i| attempt("victim@example.com", ip: "10.0.5.#{i}") }

    attempt("someone-else@example.com", ip: "10.0.6.1")

    expect(response).not_to have_http_status(:too_many_requests)
  end

  it "still throttles a single IP hammering many accounts" do
    5.times { |i| attempt("user#{i}@example.com", ip: "10.9.9.9") }

    attempt("another@example.com", ip: "10.9.9.9")

    expect(response).to have_http_status(:too_many_requests)
  end
end
