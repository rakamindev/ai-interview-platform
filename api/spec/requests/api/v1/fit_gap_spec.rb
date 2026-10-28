# frozen_string_literal: true

require 'rails_helper'

# D-3: comparisons are computed on read; only the AI narrative is generated
# in the background, with an explicit status and one job at a time.
RSpec.describe 'Fit/gap API' do
  let(:organization) { create(:organization) }
  let(:portfolio)    { create(:portfolio, session: create(:session, assessment: create(:assessment, organization: organization))) }
  let(:vacancy)      { create(:vacancy, organization: organization) }
  let(:headers)      { auth_headers_for(organization).merge('Content-Type' => 'application/json') }
  let!(:skill)       { create(:portfolio_skill, portfolio: portfolio, skill_label: 'Rails', ai_level: 3) }

  before { create(:vacancy_skill, vacancy: vacancy, skill_label: 'Rails', expected_level: 3) }

  def show
    get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers
    response.parsed_body['report']
  end

  def request_narrative
    post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { fitgap: { vacancy_id: vacancy.id } }.to_json,
                                                       headers: headers
  end

  it 'returns comparisons and summary with narrative not_requested before any narrative exists (AC-45)' do
    report = show

    expect(response).to have_http_status(:ok)
    expect(report['comparisons'].first).to include('skill_label' => 'Rails', 'expected_level' => 3,
                                                   'candidate_level' => 3, 'result' => 'match')
    expect(report['summary']).to include('match' => 1, 'evidenced' => 1)
    expect(report.dig('narrative', 'status')).to eq('not_requested')
  end

  # The report links each row to its portfolio skill so the page can show the
  # evidence and the review trail without matching labels itself.
  it 'links each comparison to its portfolio skill with the probe count and review' do
    skill.update!(coverage_state: 'partial', probe_count: 2)
    travel_to(Time.utc(2026, 10, 25, 8, 0)) do
      PortfolioSkills::OverrideActions.new(skill, actor_id: 7).set(level: 4, notes: 'Contoh: tugas tertulis.')
    end

    row = show['comparisons'].first

    expect(row).to include('portfolio_skill_id' => skill.id, 'probe_count' => 2)
    expect(row['review']).to include('action' => 'override', 'ai_level' => 3, 'notes' => 'Contoh: tugas tertulis.',
                                     'actor_id' => 7, 'at' => '2026-10-25T08:00:00.000Z')
  end

  it 'has no portfolio skill link for a required skill the portfolio does not have' do
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'System Design', expected_level: 4)

    row = show['comparisons'].find { |c| c['skill_label'] == 'System Design' }

    expect(row).to include('portfolio_skill_id' => nil, 'probe_count' => nil, 'review' => nil)
  end

  it 'enqueues exactly one narrative job for repeated requests (AC-46)' do
    request_narrative
    expect(response).to have_http_status(:accepted)
    request_narrative
    expect(response).to have_http_status(:accepted)

    expect(FitGapGeneratorWorker.jobs.size).to eq(1)
    expect(show.dig('narrative', 'status')).to eq('generating')
  end

  it 'shows an override immediately and marks the narrative outdated without deleting the report (AC-44, B6)' do
    digest = FitGap::ReportPresenter.new(portfolio: portfolio, vacancy: vacancy).input_digest
    create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy, status: 'complete', narrative_source: 'ai',
                            input_digest: digest, overall_narrative: 'Contoh.')

    post "/api/v1/portfolio_skills/#{skill.id}/override", params: { override: { level: 4, notes: 'Contoh.' } }.to_json,
                                                           headers: headers

    report = show
    expect(response).to have_http_status(:ok)
    expect(report['comparisons'].first).to include('candidate_level' => 4, 'is_override' => true, 'result' => 'exceed')
    expect(report.dig('narrative', 'status')).to eq('outdated')
    expect(FitGapReport.count).to eq(1)
    expect(FitGapGeneratorWorker.jobs).to be_empty
  end

  it 'returns 409 while the portfolio is not complete' do
    portfolio.update!(generation_status: 'generating')

    show

    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body['code']).to eq('portfolio_not_ready')
  end

  it 'returns 422 for a vacancy without skills (AC-49)' do
    vacancy.vacancy_skills.destroy_all

    show

    expect(response).to have_http_status(:unprocessable_entity)
    expect(response.parsed_body['code']).to eq('vacancy_has_no_skills')
  end

  it 'exports the same comparisons and summary as the fit/gap API (AC-75)' do
    report = show
    get "/api/v1/portfolios/#{portfolio.id}/export?format=json&vacancy_id=#{vacancy.id}", headers: headers

    exported = JSON.parse(response.body)
    expect(exported['schema_version']).to eq(2)
    expect(exported.dig('fit_gap_report', 'comparisons')).to eq(report['comparisons'])
    expect(exported.dig('fit_gap_report', 'summary')).to eq(report['summary'])
  end

  it 'exposes the level source on portfolio skills' do
    PortfolioSkills::OverrideActions.new(skill, actor_id: 7).confirm

    get "/api/v1/sessions/#{portfolio.session_id}/portfolio", headers: headers

    json_skill = response.parsed_body.dig('portfolio', 'skills').first
    expect(json_skill).to include('effective_level' => 3, 'level_source' => 'assessor_confirmed')
  end
end
