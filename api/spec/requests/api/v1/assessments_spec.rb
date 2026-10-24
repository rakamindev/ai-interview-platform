# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Assessments', type: :request do
  describe 'GET /api/v1/assessments' do
    it 'returns only assessments of the tenant resolved from the JWT' do
      organization = create(:organization)
      user = create(:user)
      own_assessment = create(:assessment, tenant_id: organization.id)
      create(:assessment) # belongs to a different tenant

      get '/api/v1/assessments',
          headers: auth_headers(user_id: user.id, scheme: organization.scheme)

      expect(response).to have_http_status(:ok)
      ids = response.parsed_body.fetch('assessments').map { |a| a.fetch('id') }
      expect(ids).to eq([own_assessment.id])
    end

    it 'rejects requests that resolve no tenant' do
      get '/api/v1/assessments'

      expect(response).to have_http_status(:forbidden)
    end
  end
end
