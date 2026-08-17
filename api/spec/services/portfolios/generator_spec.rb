# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator, type: :service do
  let(:assessment) { create(:assessment) }
  let(:skill_a) do
    create(:assessment_skill, assessment: assessment, skill_id: 'SK-ENG-001',
                              skill_label: 'React / Frontend Development Core', display_order: 0)
  end
  let(:skill_b) do
    create(:assessment_skill, assessment: assessment, skill_id: 'SK-ENG-009',
                              skill_label: 'TypeScript & Type Systems', display_order: 1)
  end
  let(:session) { create(:session, assessment: assessment, status: 'ended') }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:generator) { described_class.new(session: session, gemini_client: double('gemini')) }

  before do
    skill_a
    skill_b
    # Candidate turn that evidence quotes can be verified against.
    create(:transcript_turn, session: session, turn_number: 1, speaker: 'candidate',
                             text: 'At my last job we built a real-time dashboard for logistics tracking.')
    create(:transcript_turn, session: session, turn_number: 2, speaker: 'ai',
                             text: 'Tell me more about the state management.')
    portfolio
  end

  describe 'strict AI level parsing' do
    it 'stores a valid integer level' do
      response = { 'configured_skills' => [{ 'skill_id' => 'SK-ENG-001', 'skill_label' => skill_a.skill_label,
                                             'level' => 3, 'confidence' => 'high', 'evidence' => [],
                                             'competency_summary' => 'OK' }], 'discovered_skills' => [] }
      generator.send(:save_skills, portfolio, response)
      saved = portfolio.portfolio_skills.find_by(skill_id: 'SK-ENG-001')
      expect(saved.ai_level).to eq(3)
    end

    it 'does NOT coerce invalid levels into L1' do
      %w[unknown null].each do |bad|
        response = { 'configured_skills' => [{ 'skill_id' => 'SK-ENG-001', 'skill_label' => skill_a.skill_label,
                                               'level' => bad, 'confidence' => 'low', 'evidence' => [],
                                               'competency_summary' => 'OK' }], 'discovered_skills' => [] }
        portfolio.portfolio_skills.destroy_all
        generator.send(:save_skills, portfolio, response)
        saved = portfolio.portfolio_skills.find_by(skill_id: 'SK-ENG-001')
        expect(saved.ai_level).to be_nil
        expect(saved.requires_review?).to be true
      end
    end

    it 'rejects out-of-range and non-integer levels' do
      [0, 6, 3.5, [2]].each do |bad|
        response = { 'configured_skills' => [{ 'skill_id' => 'SK-ENG-001', 'skill_label' => skill_a.skill_label,
                                               'level' => bad, 'confidence' => 'low', 'evidence' => [],
                                               'competency_summary' => 'OK' }], 'discovered_skills' => [] }
        portfolio.portfolio_skills.destroy_all
        generator.send(:save_skills, portfolio, response)
        expect(portfolio.portfolio_skills.find_by(skill_id: 'SK-ENG-001').ai_level).to be_nil
      end
    end
  end

  describe 'partial output protection' do
    it 'creates a not-assessed entry for every configured skill omitted by the model' do
      response = { 'configured_skills' => [{ 'skill_id' => 'SK-ENG-001', 'skill_label' => skill_a.skill_label,
                                             'level' => 3, 'confidence' => 'high', 'evidence' => [],
                                             'competency_summary' => 'OK' }], 'discovered_skills' => [] }
      generator.send(:save_skills, portfolio, response)
      expect(portfolio.portfolio_skills.count).to eq(2)
      omitted = portfolio.portfolio_skills.find_by(skill_id: 'SK-ENG-009')
      expect(omitted.ai_level).to be_nil
      expect(omitted.competency_summary).to include('Not assessed')
    end
  end

  describe 'evidence provenance' do
    it 'verifies a quote found verbatim in a candidate turn' do
      quote = 'At my last job we built a real-time dashboard for logistics tracking.'
      response = { 'configured_skills' => [{ 'skill_id' => 'SK-ENG-001', 'skill_label' => skill_a.skill_label,
                                             'level' => 3, 'confidence' => 'high', 'evidence' => [quote],
                                             'competency_summary' => 'OK' }], 'discovered_skills' => [] }
      generator.send(:save_skills, portfolio, response)
      saved = portfolio.portfolio_skills.find_by(skill_id: 'SK-ENG-001')
      expect(saved.evidence_provenance.first['verified']).to be true
      expect(saved.evidence_provenance.first['turn_number']).to eq(1)
      # No coverage map → deterministic confidence is low → flagged for review.
      expect(saved.ai_confidence).to eq('low')
      expect(saved.requires_review?).to be true
    end

    it 'marks quotes NOT found in candidate turns as unverified' do
      # AI-turn quote and a hallucinated quote must not verify.
      response = { 'configured_skills' => [{ 'skill_id' => 'SK-ENG-001', 'skill_label' => skill_a.skill_label,
                                             'level' => 3, 'confidence' => 'high',
                                             'evidence' => ['Tell me more about the state management.', 'This quote was never said.'],
                                             'competency_summary' => 'OK' }], 'discovered_skills' => [] }
      generator.send(:save_skills, portfolio, response)
      saved = portfolio.portfolio_skills.find_by(skill_id: 'SK-ENG-001')
      expect(saved.evidence_provenance.map { |p| p['verified'] }).to eq([false, false])
      expect(saved.requires_review?).to be true
    end
  end

  describe 'deterministic confidence' do
    it 'overrides Gemini-claimed confidence using the coverage map' do
      create(:coverage_map, session: session, skill_id: 'SK-ENG-001', skill_label: skill_a.skill_label,
                            state: 'not_yet', probe_count: 0)
      response = { 'configured_skills' => [{ 'skill_id' => 'SK-ENG-001', 'skill_label' => skill_a.skill_label,
                                             'level' => 3, 'confidence' => 'high', 'evidence' => [],
                                             'competency_summary' => 'OK' }], 'discovered_skills' => [] }
      generator.send(:save_skills, portfolio, response)
      saved = portfolio.portfolio_skills.find_by(skill_id: 'SK-ENG-001')
      # Coverage is not_yet/0 → deterministic low, NOT Gemini's claimed high.
      expect(saved.ai_confidence).to eq('low')
    end
  end
end
