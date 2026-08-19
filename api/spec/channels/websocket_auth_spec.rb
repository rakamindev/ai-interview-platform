# frozen_string_literal: true

require "rails_helper"

RSpec.describe "WebSocket authentication", type: :request do
  let(:org) { create(:organization, scheme: "test-corp") }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session) { create(:session, assessment: assessment, tenant_id: org.id) }

  describe "coverage WebSocket role check (AC-4.9)" do
    it "rejects a non-assessor role" do
      user = create(:user, role: "user")
      token = JsonWebToken.encode(user_id: user.id, role: user.role, scheme: org.scheme)

      # Attempt to connect with a non-assessor role
      # Faye::WebSocket.websocket? check prevents a normal HTTP request,
      # so we test the authentication logic directly
      middleware = CoverageWebSocketMiddleware.new(nil)
      {
        "HTTP_AUTHORIZATION" => "Bearer #{token}",
        "PATH_INFO" => "/ws/sessions/#{session.id}/coverage",
        "rack.input" => StringIO.new
      }

      # The middleware's authenticate_assessor_by_token should reject non-assessor roles
      result = middleware.send(:authenticate_assessor_by_token, token, session.id.to_s)
      expect(result[1]).to be_present # error present
    end

    it "allows an assessor role" do
      user = create(:user, role: "admin")
      token = JsonWebToken.encode(user_id: user.id, role: user.role, scheme: org.scheme)

      middleware = CoverageWebSocketMiddleware.new(nil)
      result = middleware.send(:authenticate_assessor_by_token, token, session.id.to_s)

      expect(result[0]).to eq(session)  # session returned
      expect(result[1]).to be_nil       # no error
    end
  end

  describe "audio WebSocket role check (AC-4.9)" do
    it "rejects a non-assessor role on the JWT path" do
      user = create(:user, role: "user")
      token = JsonWebToken.encode(user_id: user.id, role: user.role, scheme: org.scheme)

      middleware = AudioWebsocketMiddleware.new(nil)
      env = {
        "HTTP_AUTHORIZATION" => "Bearer #{token}",
        "PATH_INFO" => "/ws/sessions/#{session.id}/audio",
        "rack.input" => StringIO.new
      }

      result = middleware.send(:authenticate_and_load, env, session.id.to_s)
      expect(result[1]).to be_present # error present
    end

    it "allows an assessor role on the JWT path" do
      user = create(:user, role: "admin")
      token = JsonWebToken.encode(user_id: user.id, role: user.role, scheme: org.scheme)

      middleware = AudioWebsocketMiddleware.new(nil)
      env = {
        "HTTP_AUTHORIZATION" => "Bearer #{token}",
        "PATH_INFO" => "/ws/sessions/#{session.id}/audio",
        "rack.input" => StringIO.new
      }

      result = middleware.send(:authenticate_and_load, env, session.id.to_s)
      expect(result[0]).to eq(session)  # session returned
      expect(result[1]).to be_nil       # no error
    end

    it "allows a candidate via invite token (no role check)" do
      middleware = AudioWebsocketMiddleware.new(nil)
      env = {
        "PATH_INFO" => "/ws/sessions/#{session.id}/audio?token=#{session.invite_token}",
        "rack.input" => StringIO.new
      }

      result = middleware.send(:authenticate_and_load, env, session.id.to_s)
      expect(result[0]).to eq(session)
      expect(result[1]).to be_nil
    end
  end
end
