# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Tenant isolation', type: :request do
  let!(:org_a_id) { create_organization!(scheme: 'spec-org-a') }
  let!(:org_b_id) { create_organization!(scheme: 'spec-org-b') }

  let(:token_for_org_a) do
    JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: 'spec-org-a' })
  end

  after { RequestStore.clear! }

  describe 'GET /api/v1/assessments' do
    it 'never returns another tenant\'s data, even with a forged X-Tenant-Scheme header' do
      Current.tenant_id = org_b_id
      create(:assessment, tenant_id: org_b_id)
      RequestStore.clear!

      get '/api/v1/assessments',
          headers: {
            'Authorization' => "Bearer #{token_for_org_a}",
            'X-Tenant-Scheme' => 'spec-org-b'
          }

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)['assessments']).to be_empty
    end
  end
end
