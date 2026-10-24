# frozen_string_literal: true

RSpec.describe 'Fit/gap tenant access', type: :request do
  let!(:owner) do
    Organization.create!(name: 'Synthetic Owner', scheme: 'case-owner',
                         identifier: 'case-owner', host: 'owner.example.test')
  end
  let!(:outsider) do
    Organization.create!(name: 'Synthetic Outsider', scheme: 'case-outsider',
                         identifier: 'case-outsider', host: 'outsider.example.test')
  end

  let!(:assessment) do
    Assessment.create!(tenant_id: owner.id, created_by: 1,
                       name: 'Synthetic assessment', time_limit_min: 30)
  end
  let!(:session) { Session.create!(tenant_id: owner.id, assessment: assessment, status: 'ended') }
  let!(:portfolio) { Portfolio.create!(session: session, generation_status: 'complete') }
  let!(:skill) do
    PortfolioSkill.create!(portfolio: portfolio, skill_id: 'SK-ENG-001', skill_label: 'React',
                           ai_level: 2, ai_confidence: 'medium', evidence: ['Synthetic quote'],
                           competency_summary: 'Synthetic only')
  end
  let!(:vacancy) do
    Vacancy.create!(tenant_id: owner.id, created_by: 1, role_title: 'Synthetic engineer')
  end
  let!(:outsider_vacancy) do
    Vacancy.create!(tenant_id: outsider.id, created_by: 1, role_title: 'Other synthetic role')
  end
  let!(:report) do
    FitGapReport.create!(portfolio: portfolio, vacancy: vacancy,
                         skill_comparisons: [{ skill_label: 'React', required_level: 3,
                                               candidate_level: 2, delta: -1, result: 'gap' }])
  end

  def auth_headers(scheme)
    org = Organization.find_by!(scheme: scheme)
    user = User.find_or_create_by!(email: "assessor-#{org.id}@example.test") do |record|
      record.password = 'SyntheticPassword123!'
      record.role = 'admin'
      record.organization = org
    end
    token = JsonWebToken.encode(user_id: user.id, role: 'admin', scheme: scheme)
    { 'Authorization' => "Bearer #{token}" }
  end

  it 'allows the owning assessor to see the report' do
    get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: auth_headers(owner.scheme)

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body).dig('report', 'skill_comparisons', 0, 'required_level')).to eq(3)
  end

  it 'hides report, export, and override IDs from another tenant' do
    headers = auth_headers(outsider.scheme)

    get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers
    expect(response).to have_http_status(:not_found)

    get "/api/v1/portfolios/#{portfolio.id}/export?format=json&vacancy_id=#{vacancy.id}", headers: headers
    expect(response).to have_http_status(:not_found)

    post "/api/v1/portfolio_skills/#{skill.id}/override", headers: headers,
         params: { override: { override_level: 3, assessor_notes: 'Synthetic' } }
    expect(response).to have_http_status(:not_found)
    expect(skill.reload.assessor_override).to be_nil
  end

  it 'rejects a foreign vacancy when an owner exports an owned portfolio' do
    headers = auth_headers(owner.scheme)

    get "/api/v1/portfolios/#{portfolio.id}/export?format=json&vacancy_id=#{outsider_vacancy.id}", headers: headers
    expect(response).to have_http_status(:not_found)

    get "/api/v1/portfolios/#{portfolio.id}/export?format=pdf&vacancy_id=#{outsider_vacancy.id}", headers: headers
    expect(response).to have_http_status(:not_found)
  end

  it 'hides a foreign vacancy on fit/gap read and write endpoints' do
    headers = auth_headers(owner.scheme)

    get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{outsider_vacancy.id}", headers: headers
    expect(response).to have_http_status(:not_found)

    post "/api/v1/portfolios/#{portfolio.id}/fitgap", headers: headers,
         params: { fitgap: { vacancy_id: outsider_vacancy.id } }
    expect(response).to have_http_status(:not_found)

    post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", headers: headers,
         params: { vacancy_id: outsider_vacancy.id }
    expect(response).to have_http_status(:not_found)
  end

  it 'hides a foreign session portfolio from show and regenerate' do
    headers = auth_headers(outsider.scheme)

    get "/api/v1/sessions/#{session.id}/portfolio", headers: headers
    expect(response).to have_http_status(:not_found)

    post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers
    expect(response).to have_http_status(:not_found)
  end

  it 'rejects a candidate-scoped token on assessor report and export routes' do
    auth_headers(owner.scheme)
    user = User.find_by!(email: "assessor-#{owner.id}@example.test")
    token = JsonWebToken.encode(user_id: user.id, role: 'candidate', scheme: owner.scheme)
    headers = { 'Authorization' => "Bearer #{token}" }

    get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers
    expect(response).to have_http_status(:unauthorized)

    get "/api/v1/portfolios/#{portfolio.id}/export?format=json&vacancy_id=#{vacancy.id}", headers: headers
    expect(response).to have_http_status(:unauthorized)
  end

  it 'queues one generation for repeated requests and keeps the last report during failure' do
    allow(FitGapGeneratorWorker).to receive(:perform_async).and_return('synthetic-job-id')
    headers = auth_headers(owner.scheme)

    post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", headers: headers,
         params: { vacancy_id: vacancy.id }
    expect(response).to have_http_status(:accepted)
    expect(FitGapGeneratorWorker).to have_received(:perform_async).once

    post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", headers: headers,
         params: { vacancy_id: vacancy.id }
    expect(FitGapGeneratorWorker).to have_received(:perform_async).once
    expect(FitGapReport.find_by(id: report.id)).to be_present

    request_record = FitGapGenerationRequest.find_by!(portfolio: portfolio, vacancy: vacancy)
    allow(FitGap::Engine).to receive(:new).and_raise(StandardError, 'Synthetic model failure')
    FitGapGeneratorWorker.new.perform(portfolio.id, vacancy.id, request_record.request_token)

    expect(request_record.reload.status).to eq('failed')
    expect(FitGapReport.find_by(id: report.id)).to be_present

    get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers
    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body).dig('generation', 'status')).to eq('failed')
  end

  it 'turns a stalled running request into a retryable failure and ignores its old worker token' do
    allow(FitGapGeneratorWorker).to receive(:perform_async).and_return('synthetic-job-id')
    headers = auth_headers(owner.scheme)
    post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", headers: headers,
         params: { vacancy_id: vacancy.id }
    request_record = FitGapGenerationRequest.find_by!(portfolio: portfolio, vacancy: vacancy)
    old_token = request_record.request_token
    request_record.update_columns(status: 'running', updated_at: 6.minutes.ago)

    get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers
    expect(JSON.parse(response.body).dig('generation', 'status')).to eq('failed')
    expect(JSON.parse(response.body).dig('generation', 'error_code')).to eq('GenerationTimedOut')
    expect(report.reload).to be_present

    post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", headers: headers,
         params: { vacancy_id: vacancy.id }
    expect(response).to have_http_status(:accepted)
    expect(request_record.reload.status).to eq('queued')
    expect(request_record.request_token).not_to eq(old_token)
    expect(FitGapGeneratorWorker).to have_received(:perform_async).twice

    FitGapGeneratorWorker.new.perform(portfolio.id, vacancy.id, old_token)
    expect(request_record.reload.status).to eq('queued')
  end

  it 'exposes a stalled queued request as a retryable failure' do
    allow(FitGapGeneratorWorker).to receive(:perform_async).and_return('synthetic-job-id')
    headers = auth_headers(owner.scheme)
    post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", headers: headers,
         params: { vacancy_id: vacancy.id }
    request_record = FitGapGenerationRequest.find_by!(portfolio: portfolio, vacancy: vacancy)
    request_record.update_column(:updated_at, 3.minutes.ago)

    get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers

    expect(JSON.parse(response.body).dig('generation', 'status')).to eq('failed')
    expect(JSON.parse(response.body).dig('generation', 'error_code')).to eq('GenerationTimedOut')
  end

  it 'blocks an export of a stale comparison until regeneration succeeds' do
    get "/api/v1/portfolios/#{portfolio.id}/export?format=json&vacancy_id=#{vacancy.id}",
        headers: auth_headers(owner.scheme)

    expect(response).to have_http_status(:conflict)
    expect(FitGapReport.find_by(id: report.id)).to be_present
  end

  it 'exports Unicode portfolio text and the current fit/gap report as a PDF' do
    AssessorOverride.create!(portfolio_skill: skill, ai_level: 2, override_level: 2,
                             overridden_by: 1, assessor_notes: 'Synthetic change')
    report.update!(source_digest: FitGap::SourceDigest.call(portfolio: portfolio, vacancy: vacancy),
                   skill_comparisons: [{ skill_label: 'React', required_level: 3,
                                         candidate_level: nil, delta: nil, result: 'not_assessed',
                                         evidence_count: 1, reason: 'Insufficient evidence' }])

    get "/api/v1/portfolios/#{portfolio.id}/export?format=pdf&vacancy_id=#{vacancy.id}",
        headers: auth_headers(owner.scheme)

    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq('application/pdf')
    expect(response.body).to start_with('%PDF')

    get "/api/v1/portfolios/#{portfolio.id}/export?format=json&vacancy_id=#{vacancy.id}",
        headers: auth_headers(owner.scheme)
    comparison = JSON.parse(response.body).dig('fit_gap_report', 'skill_comparisons', 0)
    expect(comparison).to include('result' => 'not_assessed', 'candidate_level' => nil,
                                  'evidence_count' => 1, 'reason' => 'Insufficient evidence')
  end

  it 'does not let an older queued job replace a newer override' do
    allow(FitGapGeneratorWorker).to receive(:perform_async).and_return('synthetic-job-id')
    headers = auth_headers(owner.scheme)

    post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", headers: headers,
         params: { vacancy_id: vacancy.id }
    request_record = FitGapGenerationRequest.find_by!(portfolio: portfolio, vacancy: vacancy)
    old_token = request_record.request_token

    AssessorOverride.create!(portfolio_skill: skill, ai_level: 2, override_level: 3,
                             overridden_by: 1, assessor_notes: 'Synthetic change')
    post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", headers: headers,
         params: { vacancy_id: vacancy.id }
    new_token = request_record.reload.request_token
    expect(new_token).not_to eq(old_token)

    FitGapGeneratorWorker.new.perform(portfolio.id, vacancy.id, old_token)
    expect(request_record.reload.status).to eq('queued')
    expect(report.reload.skill_comparisons.first['candidate_level']).to eq(2)
  end

  it 'keeps the last report and queues one refresh after a same-tenant override' do
    allow(FitGapGeneratorWorker).to receive(:perform_async).and_return('synthetic-job-id')

    post "/api/v1/portfolio_skills/#{skill.id}/override", headers: auth_headers(owner.scheme),
         params: { override: { override_level: 3, assessor_notes: 'Synthetic review' } }

    expect(response).to have_http_status(:created)
    expect(report.reload).to be_present
    request_record = FitGapGenerationRequest.find_by!(portfolio: portfolio, vacancy: vacancy)
    expect(request_record.status).to eq('queued')
    expect(FitGapGeneratorWorker).to have_received(:perform_async).once

    get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: auth_headers(owner.scheme)
    expect(JSON.parse(response.body)).to include('stale' => true)
  end

  it 'keeps a saved override visible and the report stale when enqueue fails' do
    allow(FitGapGeneratorWorker).to receive(:perform_async).and_raise(StandardError, 'Synthetic queue outage')
    headers = auth_headers(owner.scheme)

    post "/api/v1/portfolio_skills/#{skill.id}/override", headers: headers,
         params: { override: { override_level: 3, assessor_notes: 'Synthetic review' } }

    expect(response).to have_http_status(:created)
    expect(JSON.parse(response.body).fetch('regeneration_failed_vacancy_ids')).to eq([vacancy.id])
    expect(skill.reload.assessor_override.override_level).to eq(3)
    expect(FitGapGenerationRequest.find_by!(portfolio: portfolio, vacancy: vacancy).status).to eq('failed')

    get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers
    expect(JSON.parse(response.body)).to include('stale' => true)

    get "/api/v1/portfolios/#{portfolio.id}/export?format=json&vacancy_id=#{vacancy.id}", headers: headers
    expect(response).to have_http_status(:conflict)
  end

  it 'fails immediately and permits retry when the queue returns no job ID' do
    allow(FitGapGeneratorWorker).to receive(:perform_async).and_return(nil, 'synthetic-job-id')
    headers = auth_headers(owner.scheme)

    post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", headers: headers,
         params: { vacancy_id: vacancy.id }

    expect(response).to have_http_status(:service_unavailable)
    request_record = FitGapGenerationRequest.find_by!(portfolio: portfolio, vacancy: vacancy)
    expect(request_record.status).to eq('failed')
    expect(request_record.error_code).to eq('EnqueueFailed')

    post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", headers: headers,
         params: { vacancy_id: vacancy.id }

    expect(response).to have_http_status(:accepted)
    expect(request_record.reload.status).to eq('queued')
    expect(FitGapGeneratorWorker).to have_received(:perform_async).twice
  end
end
