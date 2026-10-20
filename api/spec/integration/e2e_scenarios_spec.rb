# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'P0 End-to-End Scenarios (AC-T5)', type: :request do
  let(:org_a) { create_organization(name: 'Primary Org') }
  let(:admin_a) { create_user(role: 'admin') }
  let(:headers_a) { auth_headers_for(user: admin_a, organization: org_a) }

  let(:org_b) { create_organization(name: 'Second Org') }
  let(:admin_b) { create_user(role: 'admin') }
  let(:headers_b) { auth_headers_for(user: admin_b, organization: org_b) }

  let(:assessment) do
    Assessment.create!(
      tenant_id: org_a.id,
      created_by: admin_a.id,
      name: 'Backend Engineer (gap test)',
      time_limit_min: 10
    )
  end

  let!(:skill_tech_writing) do
    AssessmentSkill.create!(
      assessment: assessment,
      skill_id: 'sk-doc',
      skill_label: 'Technical Writing & Documentation',
      is_custom: false,
      expected_level: 3,
      display_order: 1,
      l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5'
    )
  end
  let!(:skill_sys_design) do
    AssessmentSkill.create!(
      assessment: assessment,
      skill_id: 'sk-sys',
      skill_label: 'System Design',
      is_custom: false,
      expected_level: 4,
      display_order: 2,
      l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5'
    )
  end
  let!(:skill_comm) do
    AssessmentSkill.create!(
      assessment: assessment,
      skill_id: 'sk-comm',
      skill_label: 'Stakeholder Communication',
      is_custom: false,
      expected_level: 3,
      display_order: 3,
      l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5'
    )
  end

  let(:session) do
    Session.create!(
      tenant_id: org_a.id,
      assessment_id: assessment.id,
      candidate_name: 'Kandidat Uji',
      invite_token: SecureRandom.hex(16),
      status: 'ended',
      end_reason: 'manual_candidate',
      duration_seconds: 78
    )
  end

  let(:vacancy) do
    v = Vacancy.create!(
      tenant_id: org_a.id,
      created_by: admin_a.id,
      role_title: 'Senior Backend Engineer',
      culture_dimensions: 'Documentation and reliability'
    )
    VacancySkill.create!(vacancy: v, skill_id: 'sk-doc', skill_label: 'Technical Writing & Documentation', expected_level: 3)
    VacancySkill.create!(vacancy: v, skill_id: 'sk-sys', skill_label: 'System Design', expected_level: 4)
    VacancySkill.create!(vacancy: v, skill_id: 'sk-comm', skill_label: 'Stakeholder Communication', expected_level: 3)
    v
  end

  let(:fake_gemini) { instance_double(Gemini::HttpClient) }

  before do
    # Scenario: Candidate discussed only documentation for 78 seconds then ended session
    TranscriptTurn.create!(
      session: session,
      turn_number: 1,
      speaker: 'candidate',
      text: 'I write RFC documents and comprehensive ADRs for technical specifications before coding.'
    )
    TranscriptTurn.create!(
      session: session,
      turn_number: 2,
      speaker: 'candidate',
      text: 'Good documentation ensures cross-team alignment and reduces architectural ambiguities.'
    )

    # Coverage maps: only documentation was touched
    CoverageMap.create!(
      session: session,
      skill_id: 'sk-doc',
      skill_label: 'Technical Writing & Documentation',
      state: 'covered',
      probe_count: 2
    )
    CoverageMap.create!(
      session: session,
      skill_id: 'sk-sys',
      skill_label: 'System Design',
      state: 'not_yet',
      probe_count: 0
    )
    CoverageMap.create!(
      session: session,
      skill_id: 'sk-comm',
      skill_label: 'Stakeholder Communication',
      state: 'not_yet',
      probe_count: 0
    )
  end

  describe 'E2E-1: Partial session classification, payload, and fit/gap honesty' do
    it 'produces 1 assessed and 2 not_assessed skills with nil ai_level, and Fit/Gap marks them not_assessed instead of Gap' do
      llm_response = {
        'configured_skills' => [
          {
            'skill_id' => 'sk-doc',
            'skill_label' => 'Technical Writing & Documentation',
            'level' => 3,
            'confidence' => 'medium',
            'evidence' => ['I write RFC documents and comprehensive ADRs', 'reduces architectural ambiguities'],
            'competency_summary' => 'Thorough documentation habits.'
          },
          {
            'skill_id' => 'sk-sys',
            'skill_label' => 'System Design',
            'level' => 1, # Model falsely gave L1 for unassessed skill
            'confidence' => 'low',
            'evidence' => [],
            'competency_summary' => 'This skill was not evaluated.'
          },
          {
            'skill_id' => 'sk-comm',
            'skill_label' => 'Stakeholder Communication',
            'level' => 1, # Model falsely gave L1 for unassessed skill
            'confidence' => 'low',
            'evidence' => [],
            'competency_summary' => 'This skill was not evaluated.'
          }
        ]
      }
      allow(fake_gemini).to receive(:generate_content).and_return(llm_response)

      # 1. Run portfolio generation
      generator = Portfolios::Generator.new(session: session, gemini_client: fake_gemini)
      portfolio = generator.call

      # Verify DB
      expect(portfolio.generation_status).to eq('complete')
      doc_skill = portfolio.portfolio_skills.find_by(skill_id: 'sk-doc')
      sys_skill = portfolio.portfolio_skills.find_by(skill_id: 'sk-sys')
      comm_skill = portfolio.portfolio_skills.find_by(skill_id: 'sk-comm')

      expect(doc_skill.assessment_status).to eq('assessed')
      expect(doc_skill.ai_level).to eq(3)

      expect(sys_skill.assessment_status).to eq('not_assessed')
      expect(sys_skill.status_reason).to eq('not_covered')
      expect(sys_skill.ai_level).to be_nil

      expect(comm_skill.assessment_status).to eq('not_assessed')
      expect(comm_skill.status_reason).to eq('not_covered')
      expect(comm_skill.ai_level).to be_nil

      # 2. Check API endpoint GET /api/v1/sessions/:id/portfolio
      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers_a
      expect(response).to have_http_status(:ok)
      api_portfolio = JSON.parse(response.body)['portfolio']

      # Verify session metrics in payload (AC-W3)
      expect(api_portfolio['duration_seconds']).to eq(78)
      expect(api_portfolio['time_limit_min']).to eq(10)
      expect(api_portfolio['end_reason']).to eq('manual_candidate')

      api_skills = api_portfolio['skills'].index_by { |s| s['skill_id'] }
      expect(api_skills['sk-doc']['assessment_status']).to eq('assessed')
      expect(api_skills['sk-doc']['ai_level']).to eq(3)

      expect(api_skills['sk-sys']['assessment_status']).to eq('not_assessed')
      expect(api_skills['sk-sys']['status_reason']).to eq('not_covered')
      expect(api_skills['sk-sys']['ai_level']).to be_nil

      expect(api_skills['sk-comm']['assessment_status']).to eq('not_assessed')
      expect(api_skills['sk-comm']['status_reason']).to eq('not_covered')
      expect(api_skills['sk-comm']['ai_level']).to be_nil

      # 3. Run Fit/Gap engine
      allow(fake_gemini).to receive(:generate_content).and_return({
        'overall_narrative' => 'Candidate meets documentation expectations.',
        'culture_narrative' => 'Strong writing culture fit.'
      })
      fitgap_engine = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_gemini)
      report = fitgap_engine.call

      comparisons = report.skill_comparisons.index_by { |c| c['skill_id'] }

      # Documentation: match
      expect(comparisons['sk-doc']['result']).to eq('match')
      expect(comparisons['sk-doc']['candidate_level']).to eq(3)

      # System Design: not_assessed (NOT GAP! Candidate is not penalized for unasked skills)
      expect(comparisons['sk-sys']['result']).to eq('not_assessed')
      expect(comparisons['sk-sys']['candidate_level']).to be_nil
      expect(comparisons['sk-sys']['delta']).to be_nil
      # Backward compatibility aliases
      expect(comparisons['sk-sys']['required_level']).to eq(4)
      expect(comparisons['sk-sys']['expected_level']).to eq(4)

      # Communication: not_assessed
      expect(comparisons['sk-comm']['result']).to eq('not_assessed')
      expect(comparisons['sk-comm']['candidate_level']).to be_nil
      expect(comparisons['sk-comm']['delta']).to be_nil
    end
  end

  describe 'E2E-2: Override persists and fit/gap incorporates manual evaluation' do
    it 'preserves assessor override through regeneration and updates fit/gap' do
      llm_response = {
        'configured_skills' => [
          {
            'skill_id' => 'sk-doc',
            'skill_label' => 'Technical Writing & Documentation',
            'level' => 3,
            'confidence' => 'medium',
            'evidence' => ['I write RFC documents and comprehensive ADRs'],
            'competency_summary' => 'Good docs.'
          }
        ]
      }
      allow(fake_gemini).to receive(:generate_content).and_return(llm_response)

      generator = Portfolios::Generator.new(session: session, gemini_client: fake_gemini)
      portfolio = generator.call

      sys_skill = portfolio.portfolio_skills.find_by(skill_id: 'sk-sys')
      expect(sys_skill.assessment_status).to eq('not_assessed')

      # 1. Initial fit/gap report before override
      allow(fake_gemini).to receive(:generate_content).and_return({
        'overall_narrative' => 'Initial evaluation.',
        'culture_narrative' => 'Culture initial.'
      })
      fitgap_engine = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_gemini)
      report = fitgap_engine.call

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers_a
      expect(response).to have_http_status(:ok)
      initial_fitgap = JSON.parse(response.body)['report']
      expect(initial_fitgap['stale']).to be(false)

      # 2. Assessor gives manual override for unassessed skill
      post "/api/v1/portfolio_skills/#{sys_skill.id}/override",
           params: {
             override: {
               override_level: 4,
               assessor_notes: 'Reviewed external GitHub repos and prior system design portfolio.'
             }
           },
           headers: headers_a

      expect(response).to have_http_status(:created)

      # 3. Report is now stale! (AC-F6, F-04)
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers_a
      expect(response).to have_http_status(:ok)
      stale_fitgap = JSON.parse(response.body)['report']
      expect(stale_fitgap['stale']).to be(true)

      # 4. Regenerate portfolio and fitgap
      generator.call

      # Verify override survived regeneration (AC-G4)
      portfolio.reload
      expect(portfolio.assessor_overrides.count).to eq(1)
      saved_override = portfolio.assessor_overrides.first
      expect(saved_override.portfolio_skill_id).to eq(sys_skill.id)
      expect(saved_override.override_level).to eq(4)
      expect(saved_override.assessor_notes).to include('Reviewed external GitHub')

      # 5. Fit/Gap after regeneration: fresh and incorporates manual evaluation
      allow(fake_gemini).to receive(:generate_content).and_return({
        'overall_narrative' => 'Candidate meets both documentation and system design requirements.',
        'culture_narrative' => 'Fit.'
      })
      refreshed_report = fitgap_engine.call
      expect(refreshed_report.stale?).to be(false)

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers_a
      expect(response).to have_http_status(:ok)
      refreshed_payload = JSON.parse(response.body)['report']
      expect(refreshed_payload['stale']).to be(false)

      comparisons = refreshed_report.skill_comparisons.index_by { |c| c['skill_id'] }
      expect(comparisons['sk-sys']['result']).to eq('match')
      expect(comparisons['sk-sys']['candidate_level']).to eq(4)
      expect(comparisons['sk-sys']['is_override']).to be(true)
      expect(comparisons['sk-sys']['level_source']).to eq('assessor')
    end
  end
  describe 'E2E-3: Model failure and recovery' do
    it 'marks portfolio failed with error_code when model fails, and recovers on retry' do
      # 1. Simulate model failure (model not found)
      allow(fake_gemini).to receive(:generate_content).and_raise(
        Gemini::HttpClient::ApiError.new('Model gemini-fake not found', status: 404)
      )

      generator = Portfolios::Generator.new(session: session, gemini_client: fake_gemini)
      expect { generator.call }.to raise_error(Gemini::HttpClient::ApiError)

      failed_portfolio = session.portfolio
      expect(failed_portfolio.generation_status).to eq('failed')
      expect(failed_portfolio.generation_error).to eq('model_not_found')

      # Verify API payload reflects failure state
      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers_a
      expect(response).to have_http_status(:ok)
      payload = JSON.parse(response.body)['portfolio']
      expect(payload['generation_status']).to eq('failed')
      expect(payload['generation_error']).to eq('model_not_found')

      # 2. Recover: model is fixed/available, retry generation
      valid_llm_response = {
        'configured_skills' => [
          {
            'skill_id' => 'sk-doc',
            'skill_label' => 'Technical Writing & Documentation',
            'level' => 3,
            'confidence' => 'medium',
            'evidence' => ['I write RFC documents and comprehensive ADRs'],
            'competency_summary' => 'Thorough documentation.'
          }
        ]
      }
      allow(fake_gemini).to receive(:generate_content).and_return(valid_llm_response)

      recovered_portfolio = generator.call
      expect(recovered_portfolio.generation_status).to eq('complete')
      expect(recovered_portfolio.generation_error).to be_nil
      expect(recovered_portfolio.portfolio_skills.count).to eq(3)
    end
  end


  describe 'E2E-4: Multi-tenant protection across all endpoints' do
    it 'returns 404 for all endpoints when accessed by Tenant B' do
      Portfolio.create!(
        session_id: session.id,
        generation_status: 'complete',
        generated_at: Time.current
      )
      portfolio = session.portfolio
      skill = portfolio.portfolio_skills.create!(
        skill_id: 'sk-doc',
        skill_label: 'Technical Writing & Documentation',
        assessment_status: 'assessed',
        ai_level: 3,
        ai_confidence: 'medium',
        competency_summary: 'Good.'
      )

      # 1. GET session portfolio
      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers_b
      expect(response).to have_http_status(:not_found)

      # 2. POST regenerate session portfolio
      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers_b
      expect(response).to have_http_status(:not_found)

      # 3. POST fitgap
      post "/api/v1/portfolios/#{portfolio.id}/fitgap",
           params: { vacancy_id: vacancy.id },
           headers: headers_b
      expect(response).to have_http_status(:not_found)

      # 4. POST regenerate_fitgap
      post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap",
           params: { vacancy_id: vacancy.id },
           headers: headers_b
      expect(response).to have_http_status(:not_found)

      # 5. GET show_fitgap
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers_b
      expect(response).to have_http_status(:not_found)

      # 6. GET export
      get "/api/v1/portfolios/#{portfolio.id}/export?format=json", headers: headers_b
      expect(response).to have_http_status(:not_found)

      # 7. POST override
      post "/api/v1/portfolio_skills/#{skill.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'Unauthorized edit' } },
           headers: headers_b
      expect(response).to have_http_status(:not_found)
    end
  end
end
