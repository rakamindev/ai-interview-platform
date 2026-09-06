# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Sessions API', type: :request do
  let(:organization) { create(:organization, scheme: 'test-corp') }
  let!(:user) { create(:user, email: 'assessor@test.com') }
  let(:token) { login_get_token(email: 'assessor@test.com', password: 'password123') }
  let(:headers) { tenant_headers.merge(auth_headers(token)) }

  before { with_current_tenant(organization) }

  describe 'DELETE /api/v1/assessments/:assessment_id/sessions/:id' do
    let!(:assessment) { create(:assessment, created_by: user.id) }
    it 'deletes a pending (invited) session' do
      session = create(:session, assessment:)

      expect { delete "/api/v1/assessments/#{assessment.id}/sessions/#{session.id}", headers: headers }
        .to change(Session, :count).by(-1)

      expect(response).to have_http_status(:ok)
      expect(json_body['message']).to eq('Session deleted')
    end

    it 'deletes an ended session' do
      session = create(:session, assessment:, status: 'ended', end_reason: 'all_covered')

      expect { delete "/api/v1/assessments/#{assessment.id}/sessions/#{session.id}", headers: headers }
        .to change(Session, :count).by(-1)

      expect(response).to have_http_status(:ok)
    end

    it 'deletes a failed session' do
      session = create(:session, assessment:, status: 'failed', end_reason: 'error')

      expect { delete "/api/v1/assessments/#{assessment.id}/sessions/#{session.id}", headers: headers }
        .to change(Session, :count).by(-1)

      expect(response).to have_http_status(:ok)
    end

    it 'refuses to delete an active (live) session' do
      session = create(:session, assessment:, status: 'active')

      expect { delete "/api/v1/assessments/#{assessment.id}/sessions/#{session.id}", headers: headers }
        .not_to change(Session, :count)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(Session.exists?(session.id)).to be(true)
    end

    it 'returns 404 when the session belongs to another assessment' do
      other = create(:assessment, created_by: user.id)
      session = create(:session, assessment: other)

      delete "/api/v1/assessments/#{assessment.id}/sessions/#{session.id}", headers: headers

      expect(response).to have_http_status(:not_found)
      expect(Session.exists?(session.id)).to be(true)
    end

    it 'returns 404 for a nonexistent session' do
      delete "/api/v1/assessments/#{assessment.id}/sessions/999999", headers: headers

      expect(response).to have_http_status(:not_found)
    end

    it 'requires an authenticated assessor' do
      session = create(:session, assessment:)

      delete "/api/v1/assessments/#{assessment.id}/sessions/#{session.id}", headers: tenant_headers

      expect(response).to have_http_status(:unauthorized)
      expect(Session.exists?(session.id)).to be(true)
    end
  end
end
