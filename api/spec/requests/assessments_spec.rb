# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Assessments', type: :request do
  let!(:org) { create(:organization, scheme: 'acme') }

  describe 'POST /api/v1/assessments' do
    it 'returns serialized JSON without leaking tenant_id, and includes skills (P1-13)' do
      post '/api/v1/assessments',
           params: { assessment: { name: 'New Assessment', time_limit_min: 30 } },
           headers: bearer_for(organization: org)

      expect(response).to have_http_status(:created)

      assessment = JSON.parse(response.body)['assessment']
      expect(assessment).to be_present
      expect(assessment).not_to have_key('tenant_id')
      expect(assessment).to have_key('skills')
      expect(assessment['name']).to eq('New Assessment')
    end
  end
end
