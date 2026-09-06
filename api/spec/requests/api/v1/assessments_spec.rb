# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'DELETE /api/v1/assessments/:id', type: :request do
  let!(:organization) do
    Organization.create!(
      name: 'Test Corp',
      scheme: 'test-corp',
      identifier: 'test-corp',
      host: 'localhost'
    )
  end

  let(:token) do
    JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: organization.scheme })
  end
  let(:headers) { { 'Authorization' => "Bearer #{token}" } }

  let!(:assessment) do
    Assessment.create!(
      name: 'Test Assessment',
      time_limit_min: 30,
      tenant_id: organization.id,
      created_by: 1
    )
  end

  context 'when no active sessions exist' do
    it 'deletes the assessment and returns success' do
      delete "/api/v1/assessments/#{assessment.id}", headers: headers
      expect(response).to have_http_status(:ok)
      expect(Assessment.find_by(id: assessment.id)).to be_nil
    end
  end

  context 'when an active session exists' do
    before do
      assessment.sessions.create!(
        status: 'active',
        tenant_id: organization.id,
        invite_token: SecureRandom.hex
      )
    end

    it 'rejects deletion and returns error' do
      delete "/api/v1/assessments/#{assessment.id}", headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
      expect(Assessment.find_by(id: assessment.id)).not_to be_nil
    end
  end
end