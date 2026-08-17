# frozen_string_literal: true

require "rails_helper"

RSpec.describe AudioWebSocketMiddleware, type: :channel do
  let(:org) { create_test_organization }
  let(:assessment) { Current.using(tenant_id: org.id) { create(:assessment) } }
  let(:session_record) { Current.using(tenant_id: org.id) { create(:session, assessment: assessment, status: "active") } }
  let(:middleware) { described_class.new(->(_env) { [200, {}, [""]] }) }

  def env_for(token:)
    Rack::MockRequest.env_for("/ws/sessions/#{session_record.id}/audio?token=#{token}")
  end

  describe "#authenticate_and_load (consent gate)" do
    it "rejects the connection when the candidate has not consented" do
      session, error = middleware.send(:authenticate_and_load, env_for(token: session_record.invite_token), session_record.id.to_s)

      expect(session).to be_nil
      expect(error).to eq("Consent required before starting the interview")
    end

    it "allows the connection once consent has been given" do
      session_record.create_consent!(given: true, given_at: Time.current, policy_version: Consent::CURRENT_POLICY_VERSION)

      session, error = middleware.send(:authenticate_and_load, env_for(token: session_record.invite_token), session_record.id.to_s)

      expect(error).to be_nil
      expect(session.id).to eq(session_record.id)
    end

    it "still rejects when consent was explicitly declined" do
      session_record.create_consent!(given: false, policy_version: Consent::CURRENT_POLICY_VERSION)

      _session, error = middleware.send(:authenticate_and_load, env_for(token: session_record.invite_token), session_record.id.to_s)

      expect(error).to eq("Consent required before starting the interview")
    end
  end
end
