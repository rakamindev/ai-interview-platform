# frozen_string_literal: true

require 'rails_helper'

# G1 (evidence integrity): structurally invalid AI output must never become part of the current
# assessment, and evidence must show textual provenance only, never "competency verified".
RSpec.describe 'Evidence integrity of AI portfolio output (G1)', type: :request do
  let(:org) { create_org }
  let(:assessment) do
    create_assessment(org: org, skills: [
                        { skill_id: 'SK-ENG-001', skill_label: 'React / Frontend Development Core' },
                        { skill_id: nil, skill_label: 'Communication' }
                      ])
  end
  let(:session) { create_interviewed_session(org: org, assessment: assessment) }

  # Candidate turns in the synthetic transcript (see spec/support/test_data.rb):
  #   turn 2: "For a live feed, context gets painful fast because every update re-renders every consumer."
  #   turn 4: "I moved the feed into a store so components subscribe to just the slice they need."
  let(:real_quote) { 'I moved the feed into a store so components subscribe to just the slice they need.' }

  def skill(label:, level:, evidence: [real_quote], skill_id: nil, confidence: 'high')
    { 'skill_id' => skill_id, 'skill_label' => label, 'level' => level, 'confidence' => confidence,
      'evidence' => evidence, 'competency_summary' => 'Summary' }
  end

  def generate(configured:, discovered: [])
    Sessions::EndHandler.new(session).call(reason: 'all_covered')
    stub_gemini({ 'configured_skills' => configured, 'discovered_skills' => discovered })
    run_job(PortfolioGeneratorWorker, last_enqueued_args(PortfolioGeneratorWorker))
    session.reload.portfolio
  end

  def current(label) = session.reload.portfolio.portfolio_skills.find_by(skill_label: label)

  describe 'levels' do
    it 'stores a missing level as Not rated, never as L1' do
      generate(configured: [skill(label: 'React / Frontend Development Core', level: nil, skill_id: 'SK-ENG-001'),
                            skill(label: 'Communication', level: 3)])
      expect(current('React / Frontend Development Core')).to have_attributes(ai_level: nil, ai_level_reason: 'missing_level')
      expect(current('Communication')).to have_attributes(ai_level: 3, ai_level_reason: nil)
    end

    it 'stores an out-of-range or non-numeric level as Not rated with a reason' do
      generate(configured: [skill(label: 'React / Frontend Development Core', level: 7, skill_id: 'SK-ENG-001'),
                            skill(label: 'Communication', level: 'high')])
      expect(current('React / Frontend Development Core')).to have_attributes(ai_level: nil, ai_level_reason: 'invalid_level')
      expect(current('Communication')).to have_attributes(ai_level: nil, ai_level_reason: 'invalid_level')
    end

    it 'shows a configured skill the AI left out as Not rated (ai_omitted), so it cannot quietly vanish' do
      generate(configured: [skill(label: 'Communication', level: 2)])
      expect(current('React / Frontend Development Core')).to have_attributes(ai_level: nil, ai_level_reason: 'ai_omitted',
                                                                             evidence: [])
    end
  end

  describe 'skill identity' do
    it 'rejects a "configured" skill that is not in the assessment, and records the rejection' do
      portfolio = generate(configured: [skill(label: 'React / Frontend Development Core', level: 3, skill_id: 'SK-ENG-001'),
                                        skill(label: 'Communication', level: 3),
                                        skill(label: 'Kubernetes', level: 5, skill_id: 'SK-NOT-CONFIGURED')])
      expect(portfolio.portfolio_skills.pluck(:skill_label)).not_to include('Kubernetes')
      expect(portfolio.current_generation.validation['rejected_skills']).to include(a_hash_including('skill_label' => 'Kubernetes'))
    end

    it 'stores the assessment\'s own skill id and label, not the ones the AI echoed back (W11)' do
      generate(configured: [skill(label: 'react / frontend development core', level: 3, skill_id: 'react-/-frontend-development-core'),
                            skill(label: 'Communication', level: 3, skill_id: 'communication')])
      react = current('React / Frontend Development Core')
      expect(react.skill_id).to eq('SK-ENG-001')
      expect(current('Communication').skill_id).to be_nil # the assessment skill has no id; none is invented
    end
  end

  describe 'quote provenance' do
    def checks_for(evidence)
      generate(configured: [skill(label: 'React / Frontend Development Core', level: 3, skill_id: 'SK-ENG-001', evidence: evidence),
                            skill(label: 'Communication', level: 3)])
      current('React / Frontend Development Core').evidence_checks
    end

    it 'marks a quote found in the candidate\'s words (ignoring case and punctuation) as a transcript match' do
      checks = checks_for(['i MOVED the feed into a store, so components subscribe to just the slice they need'])
      expect(checks.sole).to include('status' => 'transcript_match', 'turn_numbers' => [4])
    end

    it 'marks a quote with a changed word as no exact match, with only a suggested location' do
      checks = checks_for(['I moved the feed into a store so the components subscribe to the slice they need.'])
      expect(checks.sole).to include('status' => 'no_exact_match', 'suggested_turn' => 4)
      expect(checks.sole).not_to have_key('turn_numbers')
    end

    it 'marks an invented quote as not found' do
      checks = checks_for(['I architected a micro-frontend platform used by forty teams.'])
      expect(checks.sole).to include('status' => 'not_found')
    end

    it 'does not count words the interviewer said as candidate evidence' do
      checks = checks_for(['Tell me about state management in React.'])
      expect(checks.sole).to include('status' => 'not_found')
    end

    it 'matches a quote that spans two consecutive candidate turns' do
      session.transcript_turns.find_by(turn_number: 3).update!(speaker: 'candidate', text: 'So I tried something else.')
      checks = checks_for(['re-renders every consumer. So I tried something else.'])
      expect(checks.sole).to include('status' => 'transcript_match', 'turn_numbers' => [2, 3])
    end

    it 'records quote counts on the generation for later analysis' do
      # React: one real and one invented quote; Communication (default evidence): one real quote.
      checks_for([real_quote, 'I architected a micro-frontend platform used by forty teams.'])
      counts = session.reload.portfolio.current_generation.validation['quote_counts']
      expect(counts).to eq('transcript_match' => 2, 'not_found' => 1)
    end
  end

  describe 'confidence' do
    it 'is calculated from the PRD rule, not taken from the model' do
      session.coverage_maps.find_by(skill_label: 'React / Frontend Development Core').update!(state: 'covered', probe_count: 3)
      session.coverage_maps.find_by(skill_label: 'Communication').update!(state: 'initiated', probe_count: 1)
      generate(configured: [skill(label: 'React / Frontend Development Core', level: 3, skill_id: 'SK-ENG-001', confidence: 'low'),
                            skill(label: 'Communication', level: 3, confidence: 'high')])
      expect(current('React / Frontend Development Core').ai_confidence).to eq('high')
      expect(current('Communication').ai_confidence).to eq('low')
    end

    it 'is medium for a partially covered skill' do
      session.coverage_maps.find_by(skill_label: 'React / Frontend Development Core').update!(state: 'partial', probe_count: 4)
      generate(configured: [skill(label: 'React / Frontend Development Core', level: 3, skill_id: 'SK-ENG-001'),
                            skill(label: 'Communication', level: 3)])
      expect(current('React / Frontend Development Core').ai_confidence).to eq('medium')
    end
  end

  it 'exposes the Not rated reason and quote checks to the UI' do
    generate(configured: [skill(label: 'React / Frontend Development Core', level: nil, skill_id: 'SK-ENG-001'),
                          skill(label: 'Communication', level: 3)])
    get "/api/v1/sessions/#{session.id}/portfolio", headers: auth_headers(org)
    react = JSON.parse(response.body).dig('portfolio', 'skills').find { |sk| sk['skill_id'] == 'SK-ENG-001' }
    expect(react).to include('ai_level' => nil, 'ai_level_reason' => 'missing_level')
    expect(react['evidence_checks'].sole).to include('status' => 'transcript_match')
  end

  describe 'downstream readers keep working with Not rated skills' do
    it 'lets the assessor override a Not rated skill, and fit/gap treats an unrated skill as not assessed' do
      generate(configured: [skill(label: 'React / Frontend Development Core', level: nil, skill_id: 'SK-ENG-001'),
                            skill(label: 'Communication', level: 3)])
      react = current('React / Frontend Development Core')
      post "/api/v1/portfolio_skills/#{react.id}/override",
           params: { override: { override_level: 3, assessor_notes: 'Rated by hand' } }, headers: auth_headers(org)
      expect(response).to have_http_status(:created)

      vacancy = Vacancy.create!(tenant_id: org.id, created_by: 1, role_title: 'Engineer',
                                vacancy_skills_attributes: [{ skill_label: 'Communication', expected_level: 3 },
                                                            { skill_label: 'Design', expected_level: 2 }])
      AssessorOverride.delete_all
      report = FitGap::Engine.new(portfolio: session.reload.portfolio, vacancy: vacancy,
                                  gemini_client: TestData::FakeGemini.new({ 'culture_narrative' => 'c', 'overall_narrative' => 'o' })).call
      expect(report.skill_comparisons.map { |c| c['result'] || c[:result] }).to eq(%w[match not_assessed])
    end
  end
end
