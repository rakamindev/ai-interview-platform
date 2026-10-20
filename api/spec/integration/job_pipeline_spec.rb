# frozen_string_literal: true

require 'rails_helper'

# Runs Sidekiq jobs inline, so one HTTP request carries through the controller,
# the end handler, the worker, the generator and the database in one go, with
# Sidekiq's strict argument check on (job arguments must survive JSON).
#
# Jobs are never pushed to the real Redis here: the dev Sidekiq process shares
# that Redis and would pick them up against the dev database.
RSpec.describe 'Job pipeline', type: :request do
  let!(:organization) { create(:organization) }
  let(:headers)       { auth_headers_for(organization) }
  let(:assessment)    { create(:assessment, :with_skills, organization:) }
  let(:session)       { create(:session, assessment:) }

  let(:portfolio_output) do
    { 'configured_skills' => [
      { 'skill_id' => 'SK-ENG-001', 'skill_label' => 'React', 'level' => 3, 'confidence' => 'high',
        'evidence' => ['We profiled with React DevTools.'], 'competency_summary' => 'Solid L3.' }
    ] }
  end

  around do |example|
    Sidekiq.strict_args!(:raise)
    Sidekiq::Testing.inline! { example.run }
  ensure
    Sidekiq.strict_args!(false)
  end

  it 'generates the portfolio inside the request that ends the session' do
    stub_gemini(portfolio: portfolio_output)
    Sessions::StartHandler.new(session).call
    session.transcript_turns.create!(turn_number: 1, speaker: 'candidate', text: 'We profiled with React DevTools.')
    session.coverage_maps.find_by!(skill_label: 'React').update!(state: 'partial', probe_count: 2)

    post "/api/v1/sessions/#{session.id}/end_session", headers:, params: { session: { reason: 'all_covered' } }.to_json

    expect(response).to have_http_status(:ok)
    expect(session.reload.portfolio).to have_attributes(generation_status: 'complete')
    expect(session.portfolio.portfolio_skills.order(:id).pluck(:skill_label, :ai_level, :not_assessed_reason))
      .to eq([['React', 3, nil], ['Communication', nil, 'not_reached'], ['System Design', nil, 'not_reached']])
  end

  it 'compiles the interviewer prompt inside the request that creates the assessment' do
    post '/api/v1/assessments', headers:, params: {
      assessment: { name: 'Data Analyst', time_limit_min: 30, assessment_skills_attributes: [
        { skill_label: 'SQL', l1_anchor: 'a', l2_anchor: 'b', l3_anchor: 'c', l4_anchor: 'd', l5_anchor: 'e', display_order: 0 }
      ] }
    }.to_json

    expect(response).to have_http_status(:created)
    expect(Assessment.find(response.parsed_body.dig('assessment', 'id')).system_prompt).to include('SKILL: SQL')
  end

  it 'rebuilds a stale fit/gap report inside the override request' do
    stub_gemini(narrative: { 'culture_narrative' => 'c', 'overall_narrative' => 'o' })
    portfolio = create(:portfolio, session: create(:session, :ended, assessment:))
    skill     = create(:portfolio_skill, portfolio:, skill_id: 'SK-ENG-001', skill_label: 'React', ai_level: 2)
    vacancy   = create(:vacancy, organization:)
    create(:vacancy_skill, vacancy:, skill_id: 'SK-ENG-001', skill_label: 'React', expected_level: 3)
    create(:fit_gap_report, portfolio:, vacancy:)

    post "/api/v1/portfolio_skills/#{skill.id}/override", headers:,
         params: { override: { override_level: 3, assessor_notes: 'Take-home showed L3.' } }.to_json

    expect(response).to have_http_status(:created)
    expect(FitGapReport.find_by!(portfolio:, vacancy:).skill_comparisons.sole)
      .to include('candidate_level' => 3, 'result' => 'match')
  end
end
