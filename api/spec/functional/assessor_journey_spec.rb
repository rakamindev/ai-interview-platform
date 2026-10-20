# frozen_string_literal: true

require 'rails_helper'

# The reference journey from the product spec (wiki PRD 02), driven over HTTP:
# an assessor sets up a role, invites a candidate, the interview runs, and the
# assessor reviews the portfolio, overrides a rating, runs fit/gap and exports.
#
# Model calls are scripted (ScriptedGemini). The evidence quotes are verbatim
# candidate turns, so this journey stays valid once quotes are verified (P1-5).
RSpec.describe 'Assessor journey: from setup to export', type: :request do
  let!(:organization) { create(:organization) }
  let!(:assessor)     { create(:user, email: 'dimas@example.test', password: 'correct-horse-battery') }

  let(:skills) do
    [
      { skill_id: 'SK-ENG-001', skill_label: 'React', expected_level: 3 },
      { skill_id: 'SK-SOFT-001', skill_label: 'Communication', expected_level: 3 },
      { skill_id: 'SK-ENG-003', skill_label: 'System Design', expected_level: 2 }
    ]
  end

  let(:anchors) do
    { l1_anchor: 'Needs close guidance.', l2_anchor: 'Independent on routine scope.',
      l3_anchor: 'Handles ambiguity and trade-offs.', l4_anchor: 'Sets team standards.',
      l5_anchor: 'Shapes practice across the org.' }
  end

  let(:turns) do
    [
      ['ai',        'Tell me about the most technically challenging frontend project you worked on recently.'],
      ['candidate', 'We moved critical real-time data into local component state with useRef.'],
      ['ai',        'How did you convince the team to move away from Redux?'],
      ['candidate', 'I put together a one-pager with the profiling data and shared it in Slack before the meeting.'],
      ['ai',        'Where would you start if you designed the dashboard again?'],
      ['candidate', 'I would start with the data contracts and set the performance budget before the architecture.'],
      ['candidate', 'We decomposed into micro-frontends using Module Federation.']
    ]
  end

  let(:portfolio_output) do
    {
      'configured_skills' => [
        { 'skill_id' => 'SK-ENG-001', 'skill_label' => 'React', 'level' => 3, 'confidence' => 'high',
          'evidence' => ['We moved critical real-time data into local component state with useRef.'],
          'competency_summary' => 'Handles complex state with clear trade-offs.' },
        { 'skill_id' => 'SK-SOFT-001', 'skill_label' => 'Communication', 'level' => 2, 'confidence' => 'medium',
          'evidence' => ['I put together a one-pager with the profiling data and shared it in Slack before the meeting.'],
          'competency_summary' => 'Clear one to one; async communication is reactive.' },
        { 'skill_id' => 'SK-ENG-003', 'skill_label' => 'System Design', 'level' => 3, 'confidence' => 'high',
          'evidence' => ['I would start with the data contracts and set the performance budget before the architecture.'],
          'competency_summary' => 'Leads with data contracts and budgets.' }
      ],
      'discovered_skills' => [
        { 'skill_label' => 'Micro-frontend Architecture', 'level' => 2, 'confidence' => 'low',
          'evidence' => ['We decomposed into micro-frontends using Module Federation.'],
          'competency_summary' => 'Hands-on experience; briefly explored.' }
      ]
    }
  end

  let(:narrative) do
    { 'culture_narrative' => 'Strong ownership; probe async communication next.',
      'overall_narrative' => 'Recommend a second interview focused on communication.' }
  end

  it 'takes one candidate from invite to an exported fit/gap report' do
    gemini  = stub_gemini(portfolio: portfolio_output, narrative:)
    headers = sign_in_as(assessor, organization)

    # 1. Set up the assessment; the interviewer prompt is compiled in the background.
    post '/api/v1/assessments', headers:, params: {
      assessment: {
        name: 'Senior Frontend Engineer', time_limit_min: 45, language: 'en',
        assessment_skills_attributes: skills.each_with_index.map { |s, i| s.merge(anchors, display_order: i) }
      }
    }.to_json
    expect(response).to have_http_status(:created)
    assessment_id = json.dig('assessment', 'id')

    expect(run_jobs(SystemPromptGeneratorWorker)).to eq(1)
    get "/api/v1/assessments/#{assessment_id}", headers: headers
    expect(json.dig('assessment', 'skills').pluck('skill_label')).to eq(%w[React Communication System\ Design])
    expect(Assessment.find(assessment_id).system_prompt).to include('React', 'Communication', 'System Design')

    # 2. Invite the candidate.
    post "/api/v1/assessments/#{assessment_id}/sessions", headers:,
         params: { session: { candidate_name: 'Test Candidate' } }.to_json
    expect(response).to have_http_status(:created)
    session_id   = json.dig('session', 'id')
    invite_token = json.dig('session', 'invite_token')
    expect(json['invite_url']).to end_with("/interview/#{invite_token}")

    # 3. The candidate opens the link, with no account.
    get "/api/v1/sessions/#{invite_token}/candidate"
    expect(response).to have_http_status(:ok)
    expect(json).to include('role_title' => 'Senior Frontend Engineer', 'time_limit_min' => 45,
                            'session_status' => 'pending')

    # 4. The interview runs and every configured skill gets covered.
    simulate_interview(Session.find(session_id), turns:, coverage: {
                         'React' => ['covered', 5], 'Communication' => ['covered', 4], 'System Design' => ['covered', 3]
                       })

    get "/api/v1/sessions/#{session_id}/coverage", headers: headers
    expect(json['skills'].pluck('state')).to all(eq('covered'))

    # 5. The session ends; the portfolio is generated in the background.
    post "/api/v1/sessions/#{session_id}/end_session", headers:, params: { session: { reason: 'all_covered' } }.to_json
    expect(response).to have_http_status(:ok)
    expect(json.dig('session', 'status')).to eq('ended')

    get "/api/v1/sessions/#{session_id}/portfolio", headers: headers
    expect(json.dig('portfolio', 'generation_status')).to eq('pending')

    expect(run_jobs(PortfolioGeneratorWorker)).to eq(1)
    expect(gemini.prompts.map { _1[:kind] }).to eq([:portfolio])
    expect(gemini.prompts.first[:prompt]).to include('We moved critical real-time data')

    # 6. The assessor reviews the portfolio.
    get "/api/v1/sessions/#{session_id}/portfolio", headers: headers
    expect(response).to have_http_status(:ok)
    portfolio = json['portfolio']
    expect(portfolio['generation_status']).to eq('complete')

    by_label = portfolio['skills'].index_by { _1['skill_label'] }
    expect(by_label.transform_values { [_1['ai_level'], _1['ai_confidence'], _1['is_discovered']] }).to eq(
      'React'                       => [3, 'high', false],
      'Communication'               => [2, 'medium', false],
      'System Design'               => [3, 'high', false],
      'Micro-frontend Architecture' => [2, 'low', true]
    )
    expect(by_label['React']['evidence']).to eq(['We moved critical real-time data into local component state with useRef.'])

    get "/api/v1/sessions/#{session_id}/transcript", headers: headers
    expect(json['total']).to eq(turns.size)

    # 7. A vacancy with expected levels, then fit/gap.
    post '/api/v1/vacancies', headers:, params: {
      vacancy: { role_title: 'Senior Frontend Engineer (TechCorp)', culture_dimensions: 'ownership, async-first',
                 vacancy_skills_attributes: skills.map { _1.slice(:skill_id, :skill_label, :expected_level) } }
    }.to_json
    expect(response).to have_http_status(:created)
    vacancy_id = json.dig('vacancy', 'id')

    post "/api/v1/portfolios/#{portfolio['id']}/fitgap", headers:, params: { fitgap: { vacancy_id: } }.to_json
    expect(response).to have_http_status(:accepted)
    expect(run_jobs(FitGapGeneratorWorker)).to eq(1)

    get "/api/v1/portfolios/#{portfolio['id']}/fitgap/#{vacancy_id}", headers: headers
    expect(response).to have_http_status(:ok)
    results = json.dig('report', 'skill_comparisons').to_h { [_1['skill_label'], [_1['result'], _1['delta']]] }
    expect(results).to eq('React' => ['match', 0], 'Communication' => ['gap', -1], 'System Design' => ['exceed', 1])
    expect(json.dig('report', 'culture_narrative')).to eq('Strong ownership; probe async communication next.')

    # 8. The assessor disagrees on Communication; the stale report is rebuilt with the override.
    post "/api/v1/portfolio_skills/#{by_label['Communication']['id']}/override", headers:,
         params: { override: { override_level: 3, assessor_notes: 'Strong written follow-up in the take-home.' } }.to_json
    expect(response).to have_http_status(:created)
    expect(json.dig('override', 'ai_level')).to eq(2)

    get "/api/v1/portfolios/#{portfolio['id']}/fitgap/#{vacancy_id}", headers: headers
    expect(response).to have_http_status(:not_found)

    expect(run_jobs(FitGapGeneratorWorker)).to eq(1)
    get "/api/v1/portfolios/#{portfolio['id']}/fitgap/#{vacancy_id}", headers: headers
    communication = json.dig('report', 'skill_comparisons').find { _1['skill_label'] == 'Communication' }
    expect(communication).to include('candidate_level' => 3, 'result' => 'match')

    # 9. Export everything as JSON.
    get "/api/v1/portfolios/#{portfolio['id']}/export", headers:, params: { format: 'json', vacancy_id: }
    expect(response).to have_http_status(:ok)
    export = JSON.parse(response.body)
    expect(export.dig('portfolio', 'overrides').sole).to include('override_level' => 3)
    expect(export.dig('fit_gap_report', 'skill_comparisons').pluck('result')).to eq(%w[match match exceed])
  end
end
