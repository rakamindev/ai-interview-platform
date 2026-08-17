# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolio integrity endpoint (F1)', type: :request do
  let!(:org)       { create(:organization, scheme: 'acme') }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session)    { create(:session, assessment: assessment, tenant_id: org.id) }

  it 'returns an integrity view with derived states and a summary' do
    create(:assessment_skill, assessment: assessment, skill_label: 'React', expected_level: 3)
    create(:assessment_skill, assessment: assessment, skill_label: 'Kubernetes', expected_level: 4)
    create(:coverage_map, session: session, skill_label: 'React', state: 'covered', probe_count: 3)
    create(:coverage_map, session: session, skill_label: 'Kubernetes', state: 'not_yet', probe_count: 0)
    portfolio = create(:portfolio, session: session, generation_status: 'complete')
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 4, ai_confidence: 'high')

    get "/api/v1/sessions/#{session.id}/portfolio", headers: bearer_for(organization: org)

    expect(response).to have_http_status(:ok)
    integrity = JSON.parse(response.body)['integrity']
    expect(integrity['summary']).to include('assessed' => 1, 'not_assessed' => 1, 'total' => 2)

    react = integrity['skills'].find { |s| s['skill_label'] == 'React' }
    kube  = integrity['skills'].find { |s| s['skill_label'] == 'Kubernetes' }
    expect(react['state']).to eq('assessed')
    expect(react['effective_level']).to eq(4)
    # Fairness: unassessed skill exposes no level at the API boundary (AC-1/AC-3)
    expect(kube['state']).to eq('not_assessed')
    expect(kube['effective_level']).to be_nil
    expect(kube['ai_level']).to be_nil
    expect(kube['expected_level']).to eq(4)
  end

  it 'returns 202 generating when the portfolio is still being built (AC-12)' do
    create(:portfolio, session: session, generation_status: 'generating')

    get "/api/v1/sessions/#{session.id}/portfolio", headers: bearer_for(organization: org)

    expect(response).to have_http_status(:accepted)
  end
end

RSpec.describe 'Assessor override requires a reason (F2)', type: :request do
  let!(:org)       { create(:organization, scheme: 'acme') }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session)    { create(:session, assessment: assessment, tenant_id: org.id) }
  let(:portfolio)  { create(:portfolio, session: session, generation_status: 'complete') }
  let(:skill)      { create(:portfolio_skill, portfolio: portfolio) }

  it 'rejects an override with no reason (AC-19)' do
    post "/api/v1/portfolio_skills/#{skill.id}/override",
         params: { override: { override_level: 5 } }, headers: bearer_for(organization: org)

    expect(response).to have_http_status(:unprocessable_entity)
  end

  it 'accepts an override that includes a reason' do
    post "/api/v1/portfolio_skills/#{skill.id}/override",
         params: { override: { override_level: 5, assessor_notes: 'Strong evidence in the transcript.' } },
         headers: bearer_for(organization: org)

    expect(response).to have_http_status(:created)
  end
end
