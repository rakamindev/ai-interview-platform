require 'rails_helper'

RSpec.describe 'system_prompt is never exposed via the assessments API', type: :request do
  let(:organization) { create(:organization) }
  let(:headers)        { assessor_auth_headers(organization) }

  it 'omits system_prompt from GET /api/v1/assessments' do
    create(:assessment, tenant_id: organization.id, system_prompt: 'secret prompt text')

    get '/api/v1/assessments', headers: headers

    body = JSON.parse(response.body)
    expect(body['assessments'].first).not_to have_key('system_prompt')
  end

  it 'omits system_prompt from GET /api/v1/assessments/:id' do
    assessment = create(:assessment, tenant_id: organization.id, system_prompt: 'secret prompt text')

    get "/api/v1/assessments/#{assessment.id}", headers: headers

    body = JSON.parse(response.body)
    expect(body['assessment']).not_to have_key('system_prompt')
  end
end
