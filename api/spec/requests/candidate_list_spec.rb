# frozen_string_literal: true

require 'rails_helper'

# The cross-assessment candidate list. An assessor arrives holding a person's
# name, not an assessment id — but a listing endpoint that spans parents is
# also the exact shape the earlier cross-tenant leak took, so isolation is
# asserted here rather than assumed from the default scope.
RSpec.describe 'GET /api/v1/sessions/candidates', type: :request do
  let(:org)        { create_organization(scheme: 'test-corp') }
  let(:user)       { create_user(tenant: org) }
  let(:token)      { JsonWebToken.encode({ user_id: user.id, role: 'admin', scheme: org.scheme }) }
  let(:headers)    { { 'Authorization' => "Bearer #{token}" } }

  let(:backend)  { create_assessment(tenant: org, name: 'Backend Engineer') }
  let(:frontend) { create_assessment(tenant: org, name: 'Frontend Engineer') }

  def body_sessions
    JSON.parse(response.body)['sessions']
  end

  it 'returns candidates from every assessment in one list' do
    build_session(tenant: org, assessment: backend)
    build_session(tenant: org, assessment: frontend)

    get '/api/v1/sessions/candidates', headers: headers

    expect(response).to have_http_status(:ok)
    expect(body_sessions.length).to eq(2)
    expect(body_sessions.map { |s| s.dig('assessment', 'name') })
      .to contain_exactly('Backend Engineer', 'Frontend Engineer')
  end

  it 'names the assessment on each row so the list is readable on its own' do
    build_session(tenant: org, assessment: backend)

    get '/api/v1/sessions/candidates', headers: headers

    expect(body_sessions.first['assessment']).to include('id' => backend.id, 'name' => 'Backend Engineer')
  end

  it 'reports whether a report is ready, so the row can offer the right action' do
    session = build_session(tenant: org, assessment: backend)
    session.update!(status: 'ended', end_reason: 'all_covered')
    Portfolio.create!(session_id: session.id, generation_status: 'complete')

    get '/api/v1/sessions/candidates', headers: headers

    expect(body_sessions.first['portfolio_status']).to eq('complete')
  end

  it 'leaves portfolio_status null when nothing has been generated' do
    build_session(tenant: org, assessment: backend)

    get '/api/v1/sessions/candidates', headers: headers

    expect(body_sessions.first).to have_key('portfolio_status')
    expect(body_sessions.first['portfolio_status']).to be_nil
  end

  it 'never carries the invite URL — this list is not for sharing links' do
    build_session(tenant: org, assessment: backend)

    get '/api/v1/sessions/candidates', headers: headers

    row = body_sessions.first
    expect(row).not_to have_key('invite_url')
    expect(row).not_to have_key('invite_token')
  end

  it 'orders newest first' do
    older = build_session(tenant: org, assessment: backend)
    newer = build_session(tenant: org, assessment: frontend)
    older.update!(created_at: 2.days.ago)
    newer.update!(created_at: 1.hour.ago)

    get '/api/v1/sessions/candidates', headers: headers

    expect(body_sessions.map { |s| s['id'] }).to eq([newer.id, older.id])
  end

  it 'filters by status when asked' do
    build_session(tenant: org, assessment: backend)
    live = build_session(tenant: org, assessment: frontend)
    live.update!(status: 'active')

    get '/api/v1/sessions/candidates', params: { status: 'active' }, headers: headers

    expect(body_sessions.map { |s| s['id'] }).to eq([live.id])
  end

  it 'ignores a status that is not a real status rather than returning nothing' do
    build_session(tenant: org, assessment: backend)

    get '/api/v1/sessions/candidates', params: { status: "'; DROP TABLE sessions; --" }, headers: headers

    expect(response).to have_http_status(:ok)
    expect(body_sessions.length).to eq(1)
  end

  describe 'tenant isolation' do
    let(:other_org) { create_organization(scheme: 'victim-corp') }

    it "never returns another tenant's candidates" do
      build_session(tenant: org, assessment: backend)

      victim_assessment = create_assessment(tenant: other_org, name: 'VICTIM SECRET Role')
      Session.unscoped.create!(
        tenant_id: other_org.id, assessment_id: victim_assessment.id,
        status: 'pending', invite_token: SecureRandom.hex(32),
        candidate_name: 'Victim Candidate'
      )

      get '/api/v1/sessions/candidates', headers: headers

      expect(body_sessions.length).to eq(1)
      expect(response.body).not_to include('VICTIM SECRET')
      expect(response.body).not_to include('Victim Candidate')
    end
  end

  it 'refuses an unauthenticated request' do
    get '/api/v1/sessions/candidates'

    expect(response).not_to have_http_status(:ok)
  end
end
