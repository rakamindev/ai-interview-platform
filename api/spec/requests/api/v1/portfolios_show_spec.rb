require 'rails_helper'

RSpec.describe 'GET /api/v1/sessions/:id/portfolio', type: :request do
  # Regression coverage for assessment/03_defining_problem_and_gap_to_ideal_condition.md F4:
  # a session that never started must not be reported the same way as one
  # whose portfolio worker is genuinely in flight — the frontend renders a
  # fake "analyzing... ~2 minutes" message for the latter, which must not
  # leak into the former.
  let!(:organization) { create(:organization) }
  let(:headers) { assessor_auth_headers(organization: organization) }
  let(:assessment) { create(:assessment, tenant_id: organization.id) }

  it 'reports not_started (not generating) for a session that never started and has no portfolio' do
    session = create(:session, assessment: assessment, tenant_id: organization.id, status: 'pending')

    get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)).to eq('status' => 'not_started')
  end

  # Reviewer feedback on F4: an interview that is still running has nothing for
  # the AI to analyze yet, so it must not be reported as "generating" either.
  it 'reports in_progress (not generating) for a session whose interview is still running' do
    session = create(:session, assessment: assessment, tenant_id: organization.id, status: 'active')

    get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)).to eq('status' => 'in_progress')
  end

  it 'reports generating for an ended session whose portfolio worker has not produced a row yet' do
    session = create(:session, assessment: assessment, tenant_id: organization.id, status: 'ended')

    get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

    expect(response).to have_http_status(:accepted)
    expect(JSON.parse(response.body)).to eq('status' => 'generating')
  end

  it 'reports generating while a portfolio row exists but is still processing' do
    session = create(:session, assessment: assessment, tenant_id: organization.id, status: 'ended')
    create(:portfolio, session: session, generation_status: 'generating')

    get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

    expect(response).to have_http_status(:accepted)
    expect(JSON.parse(response.body)).to eq('status' => 'generating')
  end

  it 'returns the completed portfolio once generation_status is complete' do
    session = create(:session, assessment: assessment, tenant_id: organization.id, status: 'ended')
    create(:portfolio, session: session, generation_status: 'complete')

    get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)['portfolio']['generation_status']).to eq('complete')
  end
end
