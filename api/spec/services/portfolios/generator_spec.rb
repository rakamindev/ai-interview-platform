# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:org) { create_organization }
  let(:user) { create_user }
  let(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      created_by: user.id,
      name: 'Fullstack Engineer',
      time_limit_min: 30
    )
  end
  let!(:skill_ruby) do
    AssessmentSkill.create!(
      assessment: assessment,
      skill_id: 'sk-ruby',
      skill_label: 'Ruby on Rails',
      is_custom: false,
      expected_level: 3,
      display_order: 1,
      l1_anchor: 'Junior',
      l2_anchor: 'Mid',
      l3_anchor: 'Senior',
      l4_anchor: 'Lead',
      l5_anchor: 'Principal'
    )
  end
  let!(:skill_system_design) do
    AssessmentSkill.create!(
      assessment: assessment,
      skill_id: 'sk-sys',
      skill_label: 'System Design',
      is_custom: false,
      expected_level: 4,
      display_order: 2,
      l1_anchor: 'Junior',
      l2_anchor: 'Mid',
      l3_anchor: 'Senior',
      l4_anchor: 'Lead',
      l5_anchor: 'Principal'
    )
  end
  let(:session) do
    Session.create!(
      tenant_id: org.id,
      assessment_id: assessment.id,
      invite_token: SecureRandom.hex(16),
      status: 'ended'
    )
  end

  let(:fake_gemini) { instance_double(Gemini::HttpClient) }

  before do
    # Add transcript turns
    TranscriptTurn.create!(
      session: session,
      turn_number: 1,
      speaker: 'ai',
      text: 'Tell me about how you design ActiveRecord models in Rails.'
    )
    TranscriptTurn.create!(
      session: session,
      turn_number: 2,
      speaker: 'candidate',
      text: 'I always use single responsibility and extract service objects when business logic grows. For caching, we used Redis extensively.'
    )
    TranscriptTurn.create!(
      session: session,
      turn_number: 3,
      speaker: 'candidate',
      text: 'We also indexed polymorphic foreign keys to optimize query latency.'
    )
  end

  describe 'AC-G1 & AC-G2 & AC-G3: Classification and Quote Validation' do
    it 'classifies not_covered skills as not_assessed with ai_level nil even if LLM gives a rating' do
      # Coverage map for Ruby is covered
      CoverageMap.create!(
        session: session,
        skill_id: 'sk-ruby',
        skill_label: 'Ruby on Rails',
        state: 'covered',
        probe_count: 3
      )
      # System design is not_yet with 0 probes
      CoverageMap.create!(
        session: session,
        skill_id: 'sk-sys',
        skill_label: 'System Design',
        state: 'not_yet',
        probe_count: 0
      )

      llm_response = {
        'configured_skills' => [
          {
            'skill_id' => 'sk-ruby',
            'skill_label' => 'Ruby on Rails',
            'level' => 3,
            'confidence' => 'high',
            'evidence' => ['extract service objects when business logic grows', 'used Redis extensively'],
            'competency_summary' => 'Shows good architecture practices.'
          },
          {
            'skill_id' => 'sk-sys',
            'skill_label' => 'System Design',
            'level' => 2, # LLM claimed level 2 despite not_covered!
            'confidence' => 'low',
            'evidence' => ['we used Redis extensively'],
            'competency_summary' => 'Not deeply explored.'
          }
        ]
      }
      allow(fake_gemini).to receive(:generate_content).and_return(llm_response)

      generator = described_class.new(session: session, gemini_client: fake_gemini)
      portfolio = generator.call

      expect(portfolio.generation_status).to eq('complete')

      ruby_ps = portfolio.portfolio_skills.find_by(skill_id: 'sk-ruby')
      expect(ruby_ps.assessment_status).to eq('assessed')
      expect(ruby_ps.ai_level).to eq(3)
      expect(ruby_ps.ai_confidence).to eq('high')
      expect(ruby_ps.evidence.size).to eq(2)

      # System design MUST be not_assessed with ai_level nil (Classification wins over LLM!)
      sys_ps = portfolio.portfolio_skills.find_by(skill_id: 'sk-sys')
      expect(sys_ps.assessment_status).to eq('not_assessed')
      expect(sys_ps.status_reason).to eq('not_covered')
      expect(sys_ps.ai_level).to be_nil
      expect(sys_ps.ai_confidence).to be_nil
    end

    it 'classifies as not_assessed (no_valid_evidence) when quotes do not match candidate transcript' do
      CoverageMap.create!(
        session: session,
        skill_id: 'sk-ruby',
        skill_label: 'Ruby on Rails',
        state: 'covered',
        probe_count: 3
      )

      llm_response = {
        'configured_skills' => [
          {
            'skill_id' => 'sk-ruby',
            'skill_label' => 'Ruby on Rails',
            'level' => 3,
            'confidence' => 'high',
            # Quote does not appear anywhere in candidate turns!
            'evidence' => ['Fabricated quote about microservices with gRPC and Kafka'],
            'competency_summary' => 'Good knowledge.'
          }
        ]
      }
      allow(fake_gemini).to receive(:generate_content).and_return(llm_response)

      generator = described_class.new(session: session, gemini_client: fake_gemini)
      portfolio = generator.call

      ruby_ps = portfolio.portfolio_skills.find_by(skill_id: 'sk-ruby')
      expect(ruby_ps.assessment_status).to eq('not_assessed')
      expect(ruby_ps.status_reason).to eq('no_valid_evidence')
      expect(ruby_ps.ai_level).to be_nil
      expect(ruby_ps.evidence).to be_empty
    end

    it 'discards quotes spoken by AI speaker (candidate turns only)' do
      CoverageMap.create!(
        session: session,
        skill_id: 'sk-ruby',
        skill_label: 'Ruby on Rails',
        state: 'covered',
        probe_count: 3
      )

      llm_response = {
        'configured_skills' => [
          {
            'skill_id' => 'sk-ruby',
            'skill_label' => 'Ruby on Rails',
            'level' => 3,
            'confidence' => 'high',
            # Turn 1 was spoken by AI, not candidate!
            'evidence' => ['design ActiveRecord models in Rails'],
            'competency_summary' => 'Good knowledge.'
          }
        ]
      }
      allow(fake_gemini).to receive(:generate_content).and_return(llm_response)

      generator = described_class.new(session: session, gemini_client: fake_gemini)
      portfolio = generator.call

      ruby_ps = portfolio.portfolio_skills.find_by(skill_id: 'sk-ruby')
      expect(ruby_ps.assessment_status).to eq('not_assessed')
      expect(ruby_ps.status_reason).to eq('no_valid_evidence')
    end

    it 'classifies as insufficient_evidence when probe_count < 2 or only 1 valid quote (forced low confidence)' do
      CoverageMap.create!(
        session: session,
        skill_id: 'sk-ruby',
        skill_label: 'Ruby on Rails',
        state: 'initiated',
        probe_count: 1
      )

      llm_response = {
        'configured_skills' => [
          {
            'skill_id' => 'sk-ruby',
            'skill_label' => 'Ruby on Rails',
            'level' => 3,
            'confidence' => 'high', # Even if LLM says high, must force low
            'evidence' => ['extract service objects when business logic grows'],
            'competency_summary' => 'Only touched briefly.'
          }
        ]
      }
      allow(fake_gemini).to receive(:generate_content).and_return(llm_response)

      generator = described_class.new(session: session, gemini_client: fake_gemini)
      portfolio = generator.call

      ruby_ps = portfolio.portfolio_skills.find_by(skill_id: 'sk-ruby')
      expect(ruby_ps.assessment_status).to eq('insufficient_evidence')
      expect(ruby_ps.ai_level).to eq(3)
      expect(ruby_ps.ai_confidence).to eq('low')
      expect(ruby_ps.evidence.size).to eq(1)
    end

    it 'marks missing_from_model_output when skill is not present in LLM output' do
      CoverageMap.create!(
        session: session,
        skill_id: 'sk-ruby',
        skill_label: 'Ruby on Rails',
        state: 'covered',
        probe_count: 3
      )

      llm_response = {
        'configured_skills' => [] # empty!
      }
      allow(fake_gemini).to receive(:generate_content).and_return(llm_response)

      generator = described_class.new(session: session, gemini_client: fake_gemini)
      portfolio = generator.call

      ruby_ps = portfolio.portfolio_skills.find_by(skill_id: 'sk-ruby')
      expect(ruby_ps.assessment_status).to eq('not_assessed')
      expect(ruby_ps.status_reason).to eq('missing_from_model_output')
      expect(ruby_ps.ai_level).to be_nil
    end

    it 'marks invalid_model_output when LLM provides invalid level like 0, 6, or string N/A' do
      CoverageMap.create!(
        session: session,
        skill_id: 'sk-ruby',
        skill_label: 'Ruby on Rails',
        state: 'covered',
        probe_count: 3
      )

      llm_response = {
        'configured_skills' => [
          {
            'skill_id' => 'sk-ruby',
            'skill_label' => 'Ruby on Rails',
            'level' => 'N/A',
            'confidence' => 'low',
            'evidence' => ['used Redis extensively'],
            'competency_summary' => 'N/A'
          }
        ]
      }
      allow(fake_gemini).to receive(:generate_content).and_return(llm_response)

      generator = described_class.new(session: session, gemini_client: fake_gemini)
      portfolio = generator.call

      ruby_ps = portfolio.portfolio_skills.find_by(skill_id: 'sk-ruby')
      expect(ruby_ps.assessment_status).to eq('not_assessed')
      expect(ruby_ps.status_reason).to eq('invalid_model_output')
      expect(ruby_ps.ai_level).to be_nil
    end
  end

  describe 'AC-G4: Override preservation across regeneration' do
    it 'preserves assessor overrides during portfolio regeneration' do
      CoverageMap.create!(
        session: session,
        skill_id: 'sk-ruby',
        skill_label: 'Ruby on Rails',
        state: 'covered',
        probe_count: 3
      )
      CoverageMap.create!(
        session: session,
        skill_id: 'sk-sys',
        skill_label: 'System Design',
        state: 'covered',
        probe_count: 2
      )

      llm_response = {
        'configured_skills' => [
          {
            'skill_id' => 'sk-ruby',
            'skill_label' => 'Ruby on Rails',
            'level' => 2,
            'confidence' => 'medium',
            'evidence' => ['used Redis extensively', 'optimize query latency'],
            'competency_summary' => 'Initial run'
          },
          {
            'skill_id' => 'sk-sys',
            'skill_label' => 'System Design',
            'level' => 1,
            'confidence' => 'low',
            'evidence' => ['extract service objects when business logic grows', 'optimize query latency'],
            'competency_summary' => 'Initial run'
          }
        ]
      }
      allow(fake_gemini).to receive(:generate_content).and_return(llm_response)

      generator = described_class.new(session: session, gemini_client: fake_gemini)
      portfolio = generator.call

      # Assessor creates an override for System Design (L1 -> L4)
      sys_ps = portfolio.portfolio_skills.find_by(skill_id: 'sk-sys')
      override = sys_ps.create_assessor_override!(
        ai_level: sys_ps.ai_level,
        override_level: 4,
        assessor_notes: 'Candidate explained advanced scaling in another discussion.',
        overridden_by: user.id,
        overridden_at: 10.minutes.ago
      )

      expect(portfolio.assessor_overrides.count).to eq(1)

      # Now regenerate portfolio with second LLM response
      second_response = {
        'configured_skills' => [
          {
            'skill_id' => 'sk-ruby',
            'skill_label' => 'Ruby on Rails',
            'level' => 3,
            'confidence' => 'high',
            'evidence' => ['used Redis extensively', 'optimize query latency'],
            'competency_summary' => 'Regenerated run'
          },
          {
            'skill_id' => 'sk-sys',
            'skill_label' => 'System Design',
            'level' => 2,
            'confidence' => 'medium',
            'evidence' => ['extract service objects when business logic grows', 'optimize query latency'],
            'competency_summary' => 'Regenerated run'
          }
        ]
      }
      allow(fake_gemini).to receive(:generate_content).and_return(second_response)

      generator.call

      # Verify override was NOT deleted and is still attached to System Design
      portfolio.reload
      expect(portfolio.assessor_overrides.count).to eq(1)

      reloaded_override = portfolio.assessor_overrides.first
      expect(reloaded_override.id).to eq(override.id)
      expect(reloaded_override.override_level).to eq(4)
      expect(reloaded_override.assessor_notes).to eq('Candidate explained advanced scaling in another discussion.')
      expect(reloaded_override.portfolio_skill_id).to eq(sys_ps.id)
    end
  end

  describe 'AC-G5: Concurrency and duplicate job handling' do
    it 'skips duplicate execution if status is already generating' do
      portfolio = Portfolio.create!(
        session_id: session.id,
        generation_status: 'generating'
      )

      # Gemini should never be called for duplicate job!
      expect(fake_gemini).not_to receive(:generate_content)

      generator = described_class.new(session: session, gemini_client: fake_gemini)
      result = generator.call

      expect(result.id).to eq(portfolio.id)
    end
  end

  describe 'AC-G6 & AC-G7: Model failure handling and error codes' do
    it 'maps timeout to model_timeout and keeps previous complete result intact' do
      portfolio = Portfolio.create!(
        session_id: session.id,
        generation_status: 'complete',
        generated_at: 1.hour.ago
      )
      ps = portfolio.portfolio_skills.create!(
        skill_id: 'sk-ruby',
        skill_label: 'Ruby on Rails',
        assessment_status: 'assessed',
        ai_level: 3,
        ai_confidence: 'high',
        competency_summary: 'Existing summary'
      )

      allow(fake_gemini).to receive(:generate_content).and_raise(Gemini::HttpClient::TimeoutError.new('timeout'))

      generator = described_class.new(session: session, gemini_client: fake_gemini)

      expect { generator.call }.to raise_error(Gemini::HttpClient::TimeoutError)

      portfolio.reload
      # AC-G6: status remains complete because it had a previous complete result!
      expect(portfolio.generation_status).to eq('complete')
      expect(portfolio.generation_error).to eq('model_timeout')
      # Existing skills intact
      expect(portfolio.portfolio_skills.count).to eq(1)
    end

    it 'maps 404 to model_not_found and marks failed if never complete before' do
      allow(fake_gemini).to receive(:generate_content).and_raise(
        Gemini::HttpClient::ApiError.new('Model gemini-fake not found', status: 404)
      )

      generator = described_class.new(session: session, gemini_client: fake_gemini)

      expect { generator.call }.to raise_error(Gemini::HttpClient::ApiError)

      portfolio = session.portfolio
      expect(portfolio.generation_status).to eq('failed')
      expect(portfolio.generation_error).to eq('model_not_found')
    end

    it 'maps MAX_TOKENS to model_output_truncated' do
      allow(fake_gemini).to receive(:generate_content).and_raise(
        Gemini::HttpClient::ApiError.new('Gemini response truncated (finishReason=MAX_TOKENS)')
      )

      generator = described_class.new(session: session, gemini_client: fake_gemini)

      expect { generator.call }.to raise_error(Gemini::HttpClient::ApiError)

      portfolio = session.portfolio
      expect(portfolio.generation_status).to eq('failed')
      expect(portfolio.generation_error).to eq('model_output_truncated')
    end
  end
end
