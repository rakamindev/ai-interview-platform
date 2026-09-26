# frozen_string_literal: true

require "rails_helper"

# The WebSocket endpoints authenticate on their own (they bypass the Rails
# controller stack), so they must enforce the same rules as HTTP: valid role,
# not deactivated, tenant-scoped, and unexpired invites.
RSpec.describe "WebSocket authentication" do
  let(:organization) { create(:organization) }
  let(:other_org) { create(:organization) }
  let(:assessment) { create(:assessment, organization: organization) }
  let(:session) { create(:session, assessment: assessment, status: "active", ended_at: nil) }

  def token_for(org: organization, role: "admin", user_id: 1)
    JsonWebToken.encode(user_id: user_id, role: role, scheme: org.scheme)
  end

  shared_examples "assessor websocket auth" do
    it "accepts an active assessor of the session's tenant" do
      found, error = authenticate.call(token_for(role: "assessor"))

      expect(error).to be_nil
      expect(found).to eq(session)
    end

    it "rejects a token whose role is not assessor/admin" do
      _found, error = authenticate.call(token_for(role: "user"))

      expect(error).to be_present
    end

    it "rejects a deactivated admin even with a valid signed token" do
      admin = create(:user, role: "admin", active: false, organization_id: organization.id)

      _found, error = authenticate.call(token_for(role: "admin", user_id: admin.id))

      expect(error).to be_present
    end

    it "rejects an admin bound to a different tenant than the token claims" do
      admin = create(:user, role: "admin", active: true, organization_id: other_org.id)

      _found, error = authenticate.call(token_for(role: "admin", user_id: admin.id))

      expect(error).to be_present
    end

    it "rejects another tenant's session" do
      found, error = authenticate.call(token_for(org: other_org, role: "assessor"))

      expect(found).to be_nil
      expect(error).to be_present
    end

    it "does not echo internal exception details to the client" do
      _found, error = authenticate.call("not-a-jwt")

      expect(error).to eq("Authentication failed")
    end
  end

  describe CoverageWebSocketMiddleware do
    let(:authenticate) { ->(tok) { described_class.new(nil).send(:authenticate_assessor_by_token, tok, session.id.to_s) } }

    include_examples "assessor websocket auth"
  end

  describe AudioWebSocketMiddleware do
    let(:env_for) { ->(tok) { { "HTTP_AUTHORIZATION" => "Bearer #{tok}", "rack.input" => StringIO.new, "QUERY_STRING" => "" } } }
    let(:authenticate) { ->(tok) { described_class.new(nil).send(:authenticate_and_load, env_for.call(tok), session.id.to_s) } }

    include_examples "assessor websocket auth"

    it "rejects a candidate invite that has expired without being used" do
      stale = create(:session, assessment: assessment, status: "pending", ended_at: nil, created_at: 8.days.ago)
      env = { "QUERY_STRING" => "token=#{stale.invite_token}", "rack.input" => StringIO.new }

      found, error = described_class.new(nil).send(:authenticate_and_load, env, stale.id.to_s)

      expect(found).to be_nil
      expect(error).to be_present
    end

    it "accepts a fresh pending invite" do
      fresh = create(:session, assessment: assessment, status: "pending", ended_at: nil)
      env = { "QUERY_STRING" => "token=#{fresh.invite_token}", "rack.input" => StringIO.new }

      found, error = described_class.new(nil).send(:authenticate_and_load, env, fresh.id.to_s)

      expect(error).to be_nil
      expect(found).to eq(fresh)
    end
  end
end
