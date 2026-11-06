# frozen_string_literal: true

require 'rails_helper'

# W15: the fit/gap table must be able to show the vacancy's required level (the API contract the UI reads).
# W16: the "human override" marker needs the comparison to say whether an override was applied.
# W17: when the AI narrative call fails, the report must say the summary is unavailable instead of
#      presenting a canned sentence as if it were analysis.
RSpec.describe 'Fit/gap report honesty (W15, W16, W17)', type: :request do
  let(:org) { create_org }
  let(:session) { create_interviewed_session(org: org, assessment: create_assessment(org: org)) }
  let(:quote) { 'I moved the feed into a store so components subscribe to just the slice they need.' }
  let(:portfolio) do
    Sessions::EndHandler.new(session).call(reason: 'all_covered')
    stub_gemini(model_output(level: 3, quote: quote))
    run_job(PortfolioGeneratorWorker, last_enqueued_args(PortfolioGeneratorWorker))
    session.reload.portfolio
  end
  let(:vacancy) do
    Vacancy.create!(tenant_id: org.id, created_by: 1, role_title: 'Engineer',
                    vacancy_skills_attributes: [{ skill_label: 'React / Frontend Development Core', expected_level: 4 },
                                                { skill_label: 'Design', expected_level: 2 }])
  end

  def build_report(*narrative_responses)
    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy,
                       gemini_client: TestData::FakeGemini.new(*narrative_responses)).call
  end

  def fetch_report
    get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: auth_headers(org)
    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    body['report'] || body
  end

  it 'sends the required level and the override flag for every row' do
    skill = portfolio.portfolio_skills.first
    post "/api/v1/portfolio_skills/#{skill.id}/override",
         params: { override: { override_level: 4, assessor_notes: 'Strong answer on state' } }, headers: auth_headers(org)
    build_report({ 'culture_narrative' => 'c', 'overall_narrative' => 'o' })

    rows = fetch_report['skill_comparisons'].index_by { |r| r['skill_label'] }
    expect(rows['React / Frontend Development Core']).to include('expected_level' => 4, 'candidate_level' => 4,
                                                                 'result' => 'match', 'is_override' => true)
    expect(rows['Design']).to include('expected_level' => 2, 'result' => 'not_assessed', 'is_override' => false)
  end

  it 'marks the narrative as generated when the AI call succeeds' do
    build_report({ 'culture_narrative' => 'Collaborative.', 'overall_narrative' => 'Recommend.' })
    expect(fetch_report).to include('narrative_status' => 'generated', 'culture_narrative' => 'Collaborative.',
                                    'overall_narrative' => 'Recommend.')
  end

  it 'marks the narrative as unavailable, with no invented text, when the AI call fails' do
    build_report(Gemini::HttpClient::TimeoutError.new("timeout after 30s"))
    expect(fetch_report).to include('narrative_status' => 'unavailable', 'culture_narrative' => nil,
                                    'overall_narrative' => nil)
  end

  it 'marks the narrative as unavailable when the AI returns no narrative text' do
    build_report({ 'something_else' => 'x' })
    expect(fetch_report['narrative_status']).to eq('unavailable')
  end
end
