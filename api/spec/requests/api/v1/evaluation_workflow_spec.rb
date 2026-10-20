# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Post-Interview Evaluation & Fit/Gap Workflow', type: :request do
  let!(:org_a) do
    Organization.create!(
      name: 'Tenant A Corp',
      scheme: 'tenant-a',
      identifier: 'tenant-a-id',
      host: 'tenant-a.local'
    )
  end

  let!(:org_b) do
    Organization.create!(
      name: 'Tenant B Corp',
      scheme: 'tenant-b',
      identifier: 'tenant-b-id',
      host: 'tenant-b.local'
    )
  end

  let(:token_a) do
    JsonWebToken.encode(user_id: 101, role: 'admin', scheme: org_a.scheme)
  end

  let(:token_b) do
    JsonWebToken.encode(user_id: 202, role: 'admin', scheme: org_b.scheme)
  end

  let(:headers_a) do
    {
      'Authorization' => "Bearer #{token_a}",
      'X-Tenant-Scheme' => org_a.scheme
    }
  end

  let(:headers_b) do
    {
      'Authorization' => "Bearer #{token_b}",
      'X-Tenant-Scheme' => org_b.scheme
    }
  end

  let!(:assessment_a) do
    Assessment.unscoped.create!(
      tenant_id: org_a.id,
      created_by: 101,
      name: 'Fullstack Engineer Assessment',
      time_limit_min: 30,
      language: 'en'
    )
  end

  let!(:skill_react) do
    assessment_a.assessment_skills.create!(
      skill_id: 'SK-ENG-001',
      skill_label: 'React & TypeScript',
      display_order: 1,
      expected_level: 3,
      l1_anchor: 'Basic',
      l2_anchor: 'Routine',
      l3_anchor: 'Complex',
      l4_anchor: 'Systemic',
      l5_anchor: 'Org'
    )
  end

  let!(:skill_node) do
    assessment_a.assessment_skills.create!(
      skill_id: 'SK-ENG-002',
      skill_label: 'Node.js & APIs',
      display_order: 2,
      expected_level: 3,
      l1_anchor: 'Basic',
      l2_anchor: 'Routine',
      l3_anchor: 'Complex',
      l4_anchor: 'Systemic',
      l5_anchor: 'Org'
    )
  end

  let!(:skill_sql) do
    assessment_a.assessment_skills.create!(
      skill_id: 'SK-ENG-003',
      skill_label: 'Database Design & SQL',
      display_order: 3,
      expected_level: 4,
      l1_anchor: 'Basic',
      l2_anchor: 'Routine',
      l3_anchor: 'Complex',
      l4_anchor: 'Systemic',
      l5_anchor: 'Org'
    )
  end

  let!(:skill_sys) do
    assessment_a.assessment_skills.create!(
      skill_id: 'SK-ENG-004',
      skill_label: 'System Architecture',
      display_order: 4,
      expected_level: 3,
      l1_anchor: 'Basic',
      l2_anchor: 'Routine',
      l3_anchor: 'Complex',
      l4_anchor: 'Systemic',
      l5_anchor: 'Org'
    )
  end

  let!(:session_a) do
    Session.unscoped.create!(
      tenant_id: org_a.id,
      assessment: assessment_a,
      candidate_id: 501,
      candidate_name: 'Siti Rahma',
      status: 'ended',
      end_reason: 'manual_candidate',
      started_at: 15.minutes.ago,
      ended_at: 5.minutes.ago,
      duration_seconds: 600
    )
  end

  let!(:vacancy_a) do
    v = Vacancy.unscoped.create!(
      tenant_id: org_a.id,
      created_by: 101,
      role_title: 'Senior Product Engineer',
      culture_dimensions: 'High ownership and candidate empathy',
      competency_expectations: 'Strong fullstack execution'
    )
    v.vacancy_skills.create!(skill_id: 'SK-ENG-001', skill_label: 'React & TypeScript', expected_level: 3)
    v.vacancy_skills.create!(skill_id: 'SK-ENG-002', skill_label: 'Node.js & APIs', expected_level: 3)
    v.vacancy_skills.create!(skill_id: 'SK-ENG-003', skill_label: 'Database Design & SQL', expected_level: 4)
    v.vacancy_skills.create!(skill_id: 'SK-ENG-004', skill_label: 'System Architecture', expected_level: 3)
    v
  end

  let!(:vacancy_b) do
    v = Vacancy.unscoped.create!(
      tenant_id: org_b.id,
      created_by: 202,
      role_title: 'Tenant B Role'
    )
    v.vacancy_skills.create!(skill_id: 'SK-ENG-001', skill_label: 'React & TypeScript', expected_level: 4)
    v
  end

  describe 'AC-01: Cross-Tenant Isolation & Zero Side Effects' do
    let!(:portfolio_a) do
      session_a.create_portfolio!(
        candidate_id: session_a.candidate_id,
        generation_status: 'complete',
        generated_at: Time.current
      )
    end

    let!(:portfolio_skill_a) do
      portfolio_a.portfolio_skills.create!(
        skill_id: 'SK-ENG-001',
        skill_label: 'React & TypeScript',
        is_discovered: false,
        ai_level: 3,
        ai_confidence: 'high',
        evidence: ['Built accessible React components'],
        competency_summary: 'Strong frontend execution.'
      )
    end

    let!(:report_a) do
      FitGapReport.create!(
        portfolio: portfolio_a,
        vacancy: vacancy_a,
        skill_comparisons: [
          {
            'skill_id' => 'SK-ENG-001',
            'skill_label' => 'React & TypeScript',
            'expected_level' => 3,
            'candidate_level' => 3,
            'result' => 'match',
            'delta' => 0
          }
        ],
        overall_narrative: 'Strong fit.',
        generated_at: Time.current
      )
    end

    it 'denies Tenant B access to Tenant A portfolio export, fitgap read/write, and skill override with zero side effects' do
      get "/api/v1/portfolios/#{portfolio_a.id}/export", params: { format: 'json' }, headers: headers_b
      expect(response).to have_http_status(:not_found)

      get "/api/v1/portfolios/#{portfolio_a.id}/fitgap/#{vacancy_a.id}", headers: headers_b
      expect(response).to have_http_status(:not_found)

      expect do
        post "/api/v1/portfolios/#{portfolio_a.id}/fitgap",
             params: { vacancy_id: vacancy_a.id },
             headers: headers_b
      end.not_to change(FitGapGeneratorWorker.jobs, :size)
      expect(response).to have_http_status(:not_found)

      expect do
        post "/api/v1/portfolios/#{portfolio_a.id}/regenerate_fitgap",
             params: { vacancy_id: vacancy_a.id },
             headers: headers_b
      end.not_to change(FitGapReport, :count)
      expect(response).to have_http_status(:not_found)

      expect do
        post "/api/v1/portfolio_skills/#{portfolio_skill_a.id}/override",
             params: { override: { override_level: 5, assessor_notes: 'Cross-tenant tamper attempt' } },
             headers: headers_b
      end.not_to change(AssessorOverride, :count)
      expect(response).to have_http_status(:not_found)
    end

    it 'rejects requests where X-Tenant-Scheme header conflicts with authenticated JWT scheme claim' do
      spoofed_headers = {
        'Authorization' => "Bearer #{token_b}",
        'X-Tenant-Scheme' => org_a.scheme
      }

      get "/api/v1/sessions/#{session_a.id}/portfolio", headers: spoofed_headers
      expect(response).to have_http_status(:forbidden)
    end

    it 'prevents FitGapGeneratorWorker from pairing a Portfolio and Vacancy across different tenants' do
      expect do
        FitGapGeneratorWorker.new.perform(portfolio_a.id, vacancy_b.id)
      end.not_to change(FitGapReport, :count)
    end
  end

  describe 'AC-02: 4-Tier Assessment Semantics (not_probed, insufficient_evidence, partial, covered)' do
    before do
      # Skill 1: covered (3 probes)
      session_a.coverage_maps.create!(
        skill_id: 'SK-ENG-001',
        skill_label: 'React & TypeScript',
        state: 'covered',
        probe_count: 3,
        is_discovered: false
      )
      # Skill 2: partial (2 probes)
      session_a.coverage_maps.create!(
        skill_id: 'SK-ENG-002',
        skill_label: 'Node.js & APIs',
        state: 'partial',
        probe_count: 2,
        is_discovered: false
      )
      # Skill 3: initiated (1 probe -> insufficient_evidence)
      session_a.coverage_maps.create!(
        skill_id: 'SK-ENG-003',
        skill_label: 'Database Design & SQL',
        state: 'initiated',
        probe_count: 1,
        is_discovered: false
      )
      # Missing skill_sys CoverageMap row altogether to verify reconciliation against AssessmentSkill
    end

    it 'scores only partial and covered skills, never fabricates L1 for not_yet/initiated/missing-map skills, and returns consistent session_summary and unassessed_skills' do
      fake_gemini = instance_double(Gemini::HttpClient)
      allow(fake_gemini).to receive(:generate_content).and_return(
        {
          'configured_skills' => [
            {
              'skill_id' => 'SK-ENG-001',
              'skill_label' => 'React & TypeScript',
              'level' => 3,
              'confidence' => 'high',
              'evidence' => ['Designed accessible component state machine'],
              'competency_summary' => 'Solid L3 React engineering.'
            },
            {
              'skill_id' => 'SK-ENG-002',
              'skill_label' => 'Node.js & APIs',
              'level' => 3,
              'confidence' => 'high', # should be capped to medium for partial state
              'evidence' => ['Implemented idempotent REST endpoints'],
              'competency_summary' => 'Good API design on probed scope.'
            },
            {
              'skill_id' => 'SK-ENG-003',
              'skill_label' => 'Database Design & SQL',
              'level' => nil,
              'confidence' => 'low',
              'evidence' => [],
              'competency_summary' => 'Insufficient evidence.'
            },
            {
              'skill_id' => 'SK-ENG-004',
              'skill_label' => 'System Architecture',
              'level' => nil,
              'confidence' => 'low',
              'evidence' => [],
              'competency_summary' => 'Not probed.'
            }
          ],
          'discovered_skills' => []
        }
      )

      portfolio = Portfolios::Generator.new(session: session_a, gemini_client: fake_gemini).call
      expect(portfolio.portfolio_skills.pluck(:skill_id)).to contain_exactly('SK-ENG-001', 'SK-ENG-002')

      partial_skill = portfolio.portfolio_skills.find_by(skill_id: 'SK-ENG-002')
      expect(partial_skill.ai_confidence).to eq('medium')

      get "/api/v1/sessions/#{session_a.id}/portfolio", headers: headers_a
      expect(response).to have_http_status(:ok)

      body = response.parsed_body['portfolio']
      summary = body['session_summary']
      expect(summary['configured_skills_count']).to eq(4)
      expect(summary['assessed_skills_count']).to eq(2)
      expect(summary['covered_skills_count']).to eq(1)
      expect(summary['unassessed_skills_count']).to eq(2)

      unassessed = body['unassessed_skills']
      expect(unassessed.map { |u| [u['skill_id'], u['reason']] }).to contain_exactly(
        ['SK-ENG-003', 'insufficient_evidence'],
        ['SK-ENG-004', 'not_probed']
      )
    end
  end

  describe 'AC-04 & AC-06 & AC-07: Override Validation, Fit/Gap Contract, Deduplication, Legacy Data & Freshness' do
    let!(:portfolio_a) do
      session_a.create_portfolio!(
        candidate_id: session_a.candidate_id,
        generation_status: 'complete',
        generated_at: 10.minutes.ago
      )
    end

    let!(:ps_react) do
      portfolio_a.portfolio_skills.create!(
        skill_id: 'SK-ENG-001',
        skill_label: 'React & TypeScript',
        is_discovered: false,
        ai_level: 3,
        ai_confidence: 'high',
        evidence: ['Quote 1'],
        competency_summary: 'Consistent L3.'
      )
    end

    it 'requires assessor_notes of at least 5 characters when overriding a skill rating' do
      post "/api/v1/portfolio_skills/#{ps_react.id}/override",
           params: { override: { override_level: 4, assessor_notes: '   ' } },
           headers: headers_a
      expect(response).to have_http_status(:unprocessable_entity)

      post "/api/v1/portfolio_skills/#{ps_react.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'abc' } },
           headers: headers_a
      expect(response).to have_http_status(:unprocessable_entity)

      post "/api/v1/portfolio_skills/#{ps_react.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'Demonstrated L4 architectural depth in live review.' } },
           headers: headers_a
      expect(response).to have_http_status(:created)
    end

    it 'distinguishes missing parent resource (404) from not_generated report (200) and deduplicates concurrent generation requests' do
      # Missing vacancy -> 404
      get "/api/v1/portfolios/#{portfolio_a.id}/fitgap/999999", headers: headers_a
      expect(response).to have_http_status(:not_found)

      # Valid portfolio and vacancy, report not generated yet -> 200 with status: "not_generated"
      get "/api/v1/portfolios/#{portfolio_a.id}/fitgap/#{vacancy_a.id}", headers: headers_a
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['status']).to eq('not_generated')
      expect(response.parsed_body['report']).to be_nil

      # First POST /fitgap enqueues 1 worker job
      expect do
        post "/api/v1/portfolios/#{portfolio_a.id}/fitgap",
             params: { vacancy_id: vacancy_a.id },
             headers: headers_a
      end.to change(FitGapGeneratorWorker.jobs, :size).by(1)
      expect(response).to have_http_status(:accepted)

      # Second concurrent POST /fitgap does NOT enqueue a duplicate job
      expect do
        post "/api/v1/portfolios/#{portfolio_a.id}/fitgap",
             params: { vacancy_id: vacancy_a.id },
             headers: headers_a
      end.not_to change(FitGapGeneratorWorker.jobs, :size)
      expect(response).to have_http_status(:accepted)
      expect(response.parsed_body['status']).to eq('generating')

      # GET /fitgap/:vacancy_id while job is queued returns 202 with status: "generating"
      get "/api/v1/portfolios/#{portfolio_a.id}/fitgap/#{vacancy_a.id}", headers: headers_a
      expect(response).to have_http_status(:accepted)
      expect(response.parsed_body['status']).to eq('generating')
    end

    it 'emits required_level, is_override, ai_level, assessor_notes, and not_assessed counts in FitGap::Engine' do
      ps_react.create_assessor_override!(
        ai_level: 3,
        override_level: 4,
        assessor_notes: 'Verified L4 system design leadership.',
        overridden_by: 101,
        overridden_at: Time.current
      )

      fake_gemini = instance_double(Gemini::HttpClient)
      allow(fake_gemini).to receive(:generate_content).and_raise(StandardError, 'Gemini timeout')

      report = FitGap::Engine.new(portfolio: portfolio_a, vacancy: vacancy_a, gemini_client: fake_gemini).call

      react_comp = report.skill_comparisons.find { |c| c['skill_id'] == 'SK-ENG-001' }
      expect(react_comp['required_level']).to eq(3)
      expect(react_comp['expected_level']).to eq(3)
      expect(react_comp['candidate_level']).to eq(4)
      expect(react_comp['ai_level']).to eq(3)
      expect(react_comp['is_override']).to be(true)
      expect(react_comp['assessor_notes']).to eq('Verified L4 system design leadership.')
      expect(react_comp['result']).to eq('exceed')

      unassessed_comp = report.skill_comparisons.find { |c| c['skill_id'] == 'SK-ENG-004' }
      expect(unassessed_comp['required_level']).to eq(3)
      expect(unassessed_comp['result']).to eq('not_assessed')

      expect(report.overall_narrative).to include('not assessed')
    end

    it 'normalizes legacy FitGapReport records on read and refreshes stale reports/exports after an override' do
      # Create a legacy-formatted FitGapReport (only expected_level, no required_level or is_override)
      report = FitGapReport.create!(
        portfolio: portfolio_a,
        vacancy: vacancy_a,
        skill_comparisons: [
          {
            'skill_id' => 'SK-ENG-001',
            'skill_label' => 'React & TypeScript',
            'expected_level' => 3,
            'candidate_level' => 3,
            'result' => 'match',
            'delta' => 0
          }
        ],
        overall_narrative: 'Initial match.',
        generated_at: 5.minutes.ago
      )

      get "/api/v1/portfolios/#{portfolio_a.id}/fitgap/#{vacancy_a.id}", headers: headers_a
      expect(response).to have_http_status(:ok)
      comp = response.parsed_body.dig('report', 'skill_comparisons', 0)
      expect(comp['required_level']).to eq(3)
      expect(comp['is_override']).to be(false)

      # Now create an override AFTER report.generated_at without destroying the report (simulating race/stale report)
      ps_react.create_assessor_override!(
        ai_level: 3,
        override_level: 5,
        assessor_notes: 'Exceptional L5 architecture leadership.',
        overridden_by: 101,
        overridden_at: Time.current
      )

      # Exporting JSON while report is stale recomputes comparisons with the new override_level = 5
      get "/api/v1/portfolios/#{portfolio_a.id}/export",
          params: { format: 'json', vacancy_id: vacancy_a.id },
          headers: headers_a
      expect(response).to have_http_status(:ok)
      exported = JSON.parse(response.body)
      exported_react = exported.dig('fit_gap_report', 'skill_comparisons').find { |c| c['skill_id'] == 'SK-ENG-001' }
      expect(exported_react['candidate_level']).to eq(5)
      expect(exported_react['is_override']).to be(true)

      # Exporting PDF also succeeds with valid PDF header
      get "/api/v1/portfolios/#{portfolio_a.id}/export",
          params: { format: 'pdf', vacancy_id: vacancy_a.id },
          headers: headers_a
      expect(response).to have_http_status(:ok)
      expect(response.body).to start_with('%PDF')

      # GET /fitgap/:vacancy_id detects stale report and triggers background regeneration
      expect(report.reload).to be_present
      get "/api/v1/portfolios/#{portfolio_a.id}/fitgap/#{vacancy_a.id}", headers: headers_a
      expect(response).to have_http_status(:accepted)
      expect(response.parsed_body['status']).to eq('generating')
      expect(response.parsed_body['stale']).to be(true)
    end
  end

  describe 'AC-08: Sanitized Error Presentation & Invalid Input Handling' do
    it 'does not leak raw internal exception details in GET /api/v1/sessions/:id/portfolio when failed' do
      session_a.create_portfolio!(
        candidate_id: session_a.candidate_id,
        generation_status: 'failed',
        generation_error: 'Faraday::ConnectionFailed: Failed to open TCP connection to generativelanguage.googleapis.com:443 (secret_key=AIzaSy123)'
      )

      get "/api/v1/sessions/#{session_a.id}/portfolio", headers: headers_a
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['error']).not_to include('AIzaSy123')
      expect(response.parsed_body['error']).not_to include('Faraday::ConnectionFailed')
      expect(response.parsed_body['error_code']).to eq('ai_service_unavailable')
    end

    it 'records a sanitized failure state in FitGap::GenerationTracker when FitGapGeneratorWorker raises and rejects invalid inputs' do
      portfolio = session_a.create_portfolio!(
        candidate_id: session_a.candidate_id,
        generation_status: 'complete',
        generated_at: Time.current
      )
      ps = portfolio.portfolio_skills.create!(
        skill_id: 'SK-ENG-001',
        skill_label: 'React & TypeScript',
        is_discovered: false,
        ai_level: 3,
        ai_confidence: 'high',
        evidence: ['Quote 1'],
        competency_summary: 'Consistent L3.'
      )

      # Invalid override_level out of 1..5 range -> 422
      post "/api/v1/portfolio_skills/#{ps.id}/override",
           params: { override: { override_level: 9, assessor_notes: 'Valid length note here' } },
           headers: headers_a
      expect(response).to have_http_status(:unprocessable_entity)

      # Invalid export format -> 422
      get "/api/v1/portfolios/#{portfolio.id}/export",
          params: { format: 'xml' },
          headers: headers_a
      expect(response).to have_http_status(:unprocessable_entity)

      # Worker failure marks tracker failed with sanitized message
      allow(FitGap::Engine).to receive(:new).and_raise(StandardError, 'Internal DB/LLM boom')
      expect do
        FitGapGeneratorWorker.new.perform(portfolio.id, vacancy_a.id)
      end.to raise_error(StandardError)

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy_a.id}", headers: headers_a
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['status']).to eq('failed')
      expect(response.parsed_body['error_code']).to eq('generation_failed')
      expect(response.parsed_body['message']).not_to include('Internal DB/LLM boom')
    end
  end
end
