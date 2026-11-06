# frozen_string_literal: true

require 'rails_helper'

RSpec.describe "Assessor invite management", type: :request do
  let(:session) { create(:session) }
  let(:organization) { Organization.find(session.tenant_id) }
  let(:assessor) { create(:user, role: 'assessor') }
  let(:headers) { auth_headers(assessor, organization) }

  describe "POST /api/v1/sessions/:id/revoke_invite" do
    it "revokes a pending link and reports the new status" do
      post "/api/v1/sessions/#{session.id}/revoke_invite", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body.dig('session', 'invite_status')).to eq('revoked')
      expect(session.reload.invite_revoked_at).to be_present
    end

    it "refuses to revoke a live interview" do
      session.update!(status: 'active', started_at: Time.current)

      post "/api/v1/sessions/#{session.id}/revoke_invite", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(session.reload.invite_revoked_at).to be_nil
    end

    it "refuses to revoke a completed session" do
      session.update!(status: 'ended', end_reason: 'manual_candidate', ended_at: Time.current)

      post "/api/v1/sessions/#{session.id}/revoke_invite", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(session.reload.invite_revoked_at).to be_nil
    end

    it "cannot revoke another tenant's session" do
      other_session = create(:session, assessment: create(:assessment))

      post "/api/v1/sessions/#{other_session.id}/revoke_invite", headers: headers

      expect(response).to have_http_status(:not_found)
      expect(other_session.reload.invite_revoked_at).to be_nil
    end

    it "requires an assessor token" do
      post "/api/v1/sessions/#{session.id}/revoke_invite"

      # Without a tenant or token the request is rejected before any write.
      expect(response).to have_http_status(:forbidden)
      expect(session.reload.invite_revoked_at).to be_nil
    end

    it "rejects a plain member token" do
      member = create(:user, role: 'user')

      post "/api/v1/sessions/#{session.id}/revoke_invite",
           headers: auth_headers(member, organization)

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "POST /api/v1/sessions/:id/reissue_invite" do
    it "rotates the token for an expired link" do
      session.update!(invite_expires_at: 1.minute.ago)
      old_token = session.invite_token

      post "/api/v1/sessions/#{session.id}/reissue_invite", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body['invite_url']).to include(session.reload.invite_token)
      expect(session.invite_token).not_to eq(old_token)
      expect(session.invite_reissued_count).to eq(1)
      expect(session.invite_usable?).to be(true)
    end

    it "restores a revoked link" do
      session.update!(invite_revoked_at: Time.current)

      post "/api/v1/sessions/#{session.id}/reissue_invite", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body.dig('session', 'invite_status')).to eq('pending')
      expect(session.reload.invite_revoked_at).to be_nil
    end

    it "refuses to reissue while the interview is live" do
      session.update!(status: 'active', started_at: Time.current)

      post "/api/v1/sessions/#{session.id}/reissue_invite", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "refuses to reissue a completed session" do
      session.update!(status: 'ended', end_reason: 'all_covered', ended_at: Time.current)

      post "/api/v1/sessions/#{session.id}/reissue_invite", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
