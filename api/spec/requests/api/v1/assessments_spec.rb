# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Assessments API', type: :request do
  let(:organization) { create(:organization, scheme: 'test-corp') }
  let!(:user) { create(:user, email: 'assessor@test.com') }
  let(:token) do
    login_get_token(email: 'assessor@test.com', password: 'password123')
  end
  let(:headers) { tenant_headers.merge(auth_headers(token)) }

  before { with_current_tenant(organization) }

  describe 'DELETE /api/v1/assessments/:id' do
    let!(:assessment) { create(:assessment, created_by: user.id) }

    it 'deletes an assessment that has no sessions' do
      expect { delete "/api/v1/assessments/#{assessment.id}", headers: headers }
        .to change(Assessment, :count).by(-1)

      expect(response).to have_http_status(:ok)
      expect(json_body['message']).to eq('Assessment deleted')
    end

    it 'refuses to delete an assessment that has sessions' do
      create(:session, assessment:)

      expect { delete "/api/v1/assessments/#{assessment.id}", headers: headers }
        .not_to change(Assessment, :count)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body['errors'].first['message']).to match(/sessions exist/i)
      expect(Assessment.exists?(assessment.id)).to be(true)
    end

    it 'returns 404 for a nonexistent assessment' do
      delete '/api/v1/assessments/999999', headers: headers

      expect(response).to have_http_status(:not_found)
    end

    it 'requires an authenticated assessor' do
      delete "/api/v1/assessments/#{assessment.id}", headers: tenant_headers

      expect(response).to have_http_status(:unauthorized)
      expect(Assessment.exists?(assessment.id)).to be(true)
    end
  end
end
