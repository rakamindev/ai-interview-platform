# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Refresh Token / CSRF / Logout", type: :request do
  let!(:org) { create(:organization, scheme: "test-corp", host: "test-corp.localhost") }
  let!(:user) { create(:user, email: "admin@test-corp.local", role: "admin") }

  # ── helpers ──────────────────────────────────────────────────────────

  def login(params = {})
    post "/api/v1/auth/login", params: {
      email: params.fetch(:email, user.email),
      password: params.fetch(:password, "password")
    }, headers: {
      "Referer" => "http://test-corp.localhost/"
    }
    response
  end

  # Rack 3's Set-Cookie header value is an Array of one string per cookie
  # (Rack 2 joined them with "\n" into a single string) — normalize both.
  def extract_cookies
    cookie_jar = {}
    Array(response.headers["Set-Cookie"]).flat_map { |v| v.to_s.split("\n") }.each do |raw|
      name, value = raw.split("=", 2)
      cookie_jar[name.strip.to_sym] = value.to_s.split(";").first
    end
    cookie_jar
  end

  def refresh_token_value
    extract_cookies[:refresh_token]
  end

  def csrf_token_value
    extract_cookies[:csrf_secret]
  end

  def refresh_with_csrf(csrf: csrf_token_value, rt: refresh_token_value)
    cookie_header = "refresh_token=#{rt}; csrf_secret=#{csrf}"
    post "/api/v1/auth/refresh",
      headers: {
        "X-CSRF-Token" => csrf || "",
        "Cookie" => cookie_header,
        "Referer" => "http://test-corp.localhost/"
      }
    response
  end

  def logout_with_csrf(csrf: csrf_token_value, rt: refresh_token_value)
    cookie_header = "refresh_token=#{rt}; csrf_secret=#{csrf}"
    delete "/api/v1/auth/logout",
      headers: {
        "X-CSRF-Token" => csrf || "",
        "Cookie" => cookie_header
      }
    response
  end

  # ── LOGIN sets cookies correctly ────────────────────────────────────

  describe "POST /api/v1/auth/login" do
    it "sets an httpOnly refresh_token cookie" do
      login
      expect(response).to have_http_status(:ok)

      raw = response.headers["Set-Cookie"].to_s
      expect(raw).to match(/refresh_token=[a-f0-9]+/)
      # Rack 3 emits the flag lowercase ("httponly"); match case-insensitively.
      expect(raw).to match(/httponly/i)
    end

    it "sets a non-httpOnly csrf_secret cookie" do
      login
      cookies = Array(response.headers["Set-Cookie"]).flat_map { |v| v.to_s.split("\n") }
      csrf_line = cookies.find { |l| l.include?("csrf_secret") }
      expect(csrf_line).to match(/csrf_secret=[a-f0-9]+/)
      expect(csrf_line).not_to match(/httponly/i)
    end

    it "returns an access_token in the body" do
      login
      body = response.parsed_body
      expect(body["access_token"]).to be_present
      expect(body["user"]["email"]).to eq(user.email)
      expect(body["refresh"]).to eq(true)
    end

    it "creates a RefreshToken record in the database" do
      expect { login }.to change(RefreshToken, :count).by(1)
    end
  end

  # ── REFRESH rotates the token and issues new access token ──────────

  describe "POST /api/v1/auth/refresh" do
    before { login }

    it "rotates the refresh token and returns a new access_token" do
      old_rt = refresh_token_value
      old_csrf = csrf_token_value
      rt_hash_before = RefreshToken.hash_token(old_rt)

      refresh_with_csrf(rt: old_rt, csrf: old_csrf)
      expect(response).to have_http_status(:ok)

      body = response.parsed_body
      expect(body["access_token"]).to be_present
      expect(body["user"]["id"]).to eq(user.id)

      # Old token should be marked used / revoked
      old_record = RefreshToken.find_by(token_hash: rt_hash_before)
      expect(old_record.used_at).to be_present
      expect(old_record.revoked_at).to be_present

      # New refresh cookie should be issued
      expect(refresh_token_value).to be_present
      expect(refresh_token_value).not_to eq(old_rt)
    end

    it "issues a new CSRF cookie on refresh" do
      old_csrf = csrf_token_value

      refresh_with_csrf(rt: refresh_token_value, csrf: old_csrf)
      expect(response).to have_http_status(:ok)

      new_csrf = csrf_token_value
      expect(new_csrf).to be_present
      expect(new_csrf).not_to eq(old_csrf)
    end
  end

  # ── CSRF REJECTION ──────────────────────────────────────────────────

  describe "CSRF validation" do
    before { login }

    it "rejects /refresh without X-CSRF-Token header" do
      cookie_header = "refresh_token=#{refresh_token_value}; csrf_secret=#{csrf_token_value}"
      post "/api/v1/auth/refresh",
        headers: { "Cookie" => cookie_header }

      expect(response).to have_http_status(:unauthorized)
      expect(response.parsed_body.dig("errors", 0, "message")).to eq("CSRF token mismatch")
    end

    it "rejects /refresh when header value does not match cookie" do
      # Send the real cookie value but a forged header — they won't match
      cookie_header = "refresh_token=#{refresh_token_value}; csrf_secret=#{csrf_token_value}"
      post "/api/v1/auth/refresh",
        headers: {
          "X-CSRF-Token" => "forged_value",
          "Cookie" => cookie_header
        }
      expect(response).to have_http_status(:unauthorized)
      expect(response.parsed_body.dig("errors", 0, "message")).to eq("CSRF token mismatch")
    end

    it "rejects /logout without X-CSRF-Token header" do
      cookie_header = "refresh_token=#{refresh_token_value}; csrf_secret=#{csrf_token_value}"
      delete "/api/v1/auth/logout",
        headers: { "Cookie" => cookie_header }

      expect(response).to have_http_status(:unauthorized)
    end
  end

  # ── REUSE DETECTION triggers family revocation ─────────────────────

  describe "reuse detection" do
    before { login }

    it "revokes the entire family when a used token is replayed after the grace window" do
      # First refresh — marks the original token used
      first_rt = refresh_token_value
      first_csrf = csrf_token_value
      refresh_with_csrf(rt: first_rt, csrf: first_csrf)

      # The old token was used inside the grace window — reset used_at into the past
      rt_hash = RefreshToken.hash_token(first_rt)
      record = RefreshToken.find_by(token_hash: rt_hash)
      record.update_column(:used_at, 30.seconds.ago) # well past 5s grace

      # Keep the rest of the family active (create more tokens)
      second_rt = refresh_token_value
      second_hash = RefreshToken.hash_token(second_rt)
      second_record = RefreshToken.find_by(token_hash: second_hash)

      # Replay the old token
      refresh_with_csrf(rt: first_rt, csrf: first_csrf)
      expect(response).to have_http_status(:unauthorized)
      expect(response.parsed_body.dig("errors", 0, "detail")).to eq("refresh_token_reused")

      # Family should be fully revoked
      expect(second_record.reload.revoked_at).to be_present
    end

    it "does NOT trigger revocation when the old token is replayed within the grace window" do
      old_rt = refresh_token_value
      old_csrf = csrf_token_value
      old_hash = RefreshToken.hash_token(old_rt)

      # Replay immediately (within GRACE_PERIOD of 5 seconds)
      refresh_with_csrf(rt: old_rt, csrf: old_csrf)
      expect(response).to have_http_status(:ok)

      # The token should have been used, not revoked via reuse-detection path
      record = RefreshToken.find_by(token_hash: old_hash)
      expect(record.used_at).to be_present
      expect(record.grace_period_expired?).to eq(false)
    end
  end

  # ── LOGOUT clears cookies and revokes token ────────────────────────

  describe "DELETE /api/v1/auth/logout" do
    before { login }

    it "revokes the refresh token in the database" do
      rt = refresh_token_value
      rt_hash = RefreshToken.hash_token(rt)
      record = RefreshToken.find_by(token_hash: rt_hash)

      logout_with_csrf

      expect(record.reload.revoked_at).to be_present
    end

    it "clears the refresh_token cookie" do
      logout_with_csrf
      raw = response.headers["Set-Cookie"].to_s
      # Rails sets an empty/expired cookie on delete
      expect(raw).to match(/refresh_token=.*(?:deleted|max-age=0)/i)
    end

    it "returns a success message" do
      logout_with_csrf
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["message"]).to eq("Logged out successfully")
    end

    it "handles logout gracefully when the token is already revoked" do
      rt = refresh_token_value
      rt_hash = RefreshToken.hash_token(rt)
      record = RefreshToken.find_by(token_hash: rt_hash)
      record.revoke!

      logout_with_csrf
      expect(response).to have_http_status(:ok)
    end
  end

  # ── REFRESH with missing / invalid token ──────────────────────────

  describe "edge cases" do
    before { login }

    it "rejects /refresh when no refresh_token cookie is present" do
      post "/api/v1/auth/refresh",
        headers: {
          "X-CSRF-Token" => csrf_token_value,
          "Cookie" => "csrf_secret=#{csrf_token_value}"
        }
      expect(response).to have_http_status(:unauthorized)
      expect(response.parsed_body.dig("errors", 0, "detail")).to eq("missing_refresh_token")
    end

    it "rejects /refresh with a token hash that doesn't exist" do
      cookie_header = "refresh_token=deadbeef; csrf_secret=#{csrf_token_value}"
      post "/api/v1/auth/refresh",
        headers: {
          "X-CSRF-Token" => csrf_token_value,
          "Cookie" => cookie_header
        }
      expect(response).to have_http_status(:unauthorized)
      expect(response.parsed_body.dig("errors", 0, "detail")).to eq("invalid_refresh_token")
    end

    it "rejects /refresh with an expired refresh token" do
      rt = refresh_token_value
      rt_hash = RefreshToken.hash_token(rt)
      RefreshToken.find_by(token_hash: rt_hash).update!(expires_at: 1.day.ago)

      cookie_header = "refresh_token=#{rt}; csrf_secret=#{csrf_token_value}"
      post "/api/v1/auth/refresh",
        headers: {
          "X-CSRF-Token" => csrf_token_value,
          "Cookie" => cookie_header
        }
      expect(response).to have_http_status(:unauthorized)
      expect(response.parsed_body.dig("errors", 0, "detail")).to eq("invalid_refresh_token")
    end

    it "rejects /logout when no refresh_token cookie is present" do
      delete "/api/v1/auth/logout",
        headers: {
          "X-CSRF-Token" => csrf_token_value,
          "Cookie" => "csrf_secret=#{csrf_token_value}"
        }
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["message"]).to eq("Logged out successfully")
    end
  end

  # ── GRACE WINDOW boundary (timecop) ────────────────────────────────

  describe "grace window boundary with Timecop" do
    before { login }

    it "allows a used token within the 5-second grace period" do
      rt = refresh_token_value
      csrf = csrf_token_value
      rt_hash = RefreshToken.hash_token(rt)

      Timecop.freeze(Time.current) do
        # Use the token
        refresh_with_csrf(rt: rt, csrf: csrf)
        expect(response).to have_http_status(:ok)

        # Jump forward 3 seconds (within grace)
        Timecop.travel(3.seconds.from_now)

        # Replay — should succeed (grace not expired)
        refresh_with_csrf(rt: rt, csrf: csrf)
        expect(response).to have_http_status(:ok)
      end
    end

    it "rejects a used token past the 5-second grace period with family revocation" do
      rt = refresh_token_value
      csrf = csrf_token_value
      rt_hash = RefreshToken.hash_token(rt)

      # Create an active sibling token before replaying
      sibling_rt = SecureRandom.hex(32)
      RefreshToken.create!(
        user_id: user.id,
        token_hash: RefreshToken.hash_token(sibling_rt),
        expires_at: 7.days.from_now
      )
      sibling_hash = RefreshToken.hash_token(sibling_rt)

      Timecop.freeze(Time.current) do
        # Use the token
        refresh_with_csrf(rt: rt, csrf: csrf)

        # Jump forward 6 seconds (past grace)
        Timecop.travel(6.seconds.from_now)

        # Replay — should trigger reuse detection
        refresh_with_csrf(rt: rt, csrf: csrf)
        expect(response).to have_http_status(:unauthorized)
        expect(response.parsed_body.dig("errors", 0, "detail")).to eq("refresh_token_reused")
      end

      # Sibling token should be revoked
      expect(RefreshToken.find_by(token_hash: sibling_hash)&.revoked_at).to be_present
    end
  end
end
