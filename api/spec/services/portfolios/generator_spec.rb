# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:assessment) { create(:assessment) }
  let(:session) { create(:session, assessment: assessment, end_reason: 'time_ceiling') }
  let(:gemini) { instance_double(Gemini::HttpClient) }

  let!(:system_design) { create(:assessment_skill, assessment: assessment, skill_label: 'System Design', display_order: 1) }
  let!(:testing)       { create(:assessment_skill, assessment: assessment, skill_label: 'Testing', display_order: 2) }

  def cover(label, state:, probe_count:, discovered: false)
    create(:coverage_map, session: session, skill_label: label, state: state, probe_count: probe_count,
                          is_discovered: discovered)
  end

  def model_returns(*skills)
    allow(gemini).to receive(:generate_content).and_return({ 'skills' => skills })
  end

  def generate
    described_class.new(session: session, gemini_client: gemini).call
  end

  def skill(label)
    session.reload.portfolio.portfolio_skills.find_by!(skill_label: label)
  end

  context 'when a skill was covered and the model rates it' do
    before do
      cover('System Design', state: 'covered', probe_count: 4)
      cover('Testing', state: 'partial', probe_count: 2)
      model_returns(
        { 'skill_label' => 'System Design', 'level' => 3, 'evidence' => ['I start from data contracts'],
          'competency_summary' => 'Reasons from contracts first.' },
        { 'skill_label' => 'testing', 'level' => 'L2', 'evidence' => ['Unit tests on pure functions'],
          'competency_summary' => 'Covers the basics.' }
      )
    end

    it 'stores the level and computes confidence from coverage' do
      generate

      expect(skill('System Design')).to have_attributes(assessment_status: 'assessed', ai_level: 3, ai_confidence: 'high')
      expect(skill('Testing')).to have_attributes(assessment_status: 'assessed', ai_level: 2, ai_confidence: 'medium')
      expect(session.portfolio.generation_status).to eq('complete')
    end
  end

  context 'when the interview ended before a skill was discussed' do
    before do
      cover('System Design', state: 'covered', probe_count: 3)
      cover('Testing', state: 'not_yet', probe_count: 0)
      model_returns(
        { 'skill_label' => 'System Design', 'level' => 4, 'evidence' => [], 'competency_summary' => 'Strong.' },
        { 'skill_label' => 'Testing', 'level' => 1, 'evidence' => [], 'competency_summary' => 'Invented.' }
      )
    end

    it 'marks it not assessed instead of giving it a level' do
      generate

      expect(skill('Testing')).to have_attributes(assessment_status: 'not_assessed', ai_level: nil, ai_confidence: nil)
    end

    it 'does not ask the model to rate it' do
      generate

      expect(gemini).to have_received(:generate_content) do |prompt, **|
        skills_to_rate = prompt[/SKILLS TO RATE:\n(.*)\n/, 1]
        expect(skills_to_rate).to include('System Design')
        expect(skills_to_rate).not_to include('Testing')
      end
    end
  end

  context 'when a configured skill has no coverage row at all' do
    before do
      cover('System Design', state: 'covered', probe_count: 3)
      model_returns({ 'skill_label' => 'System Design', 'level' => 3 })
    end

    it 'adds it as not assessed' do
      generate

      expect(skill('Testing')).to have_attributes(assessment_status: 'not_assessed', is_discovered: false)
    end
  end

  context 'when nothing was discussed at all' do
    before do
      cover('System Design', state: 'not_yet', probe_count: 0)
      cover('Testing', state: 'not_yet', probe_count: 0)
      allow(gemini).to receive(:generate_content)
    end

    it 'does not call the model and marks every skill not assessed' do
      generate

      expect(gemini).not_to have_received(:generate_content)
      expect(session.portfolio.portfolio_skills.pluck(:assessment_status)).to all(eq('not_assessed'))
      expect(session.portfolio.generation_status).to eq('complete')
    end
  end

  [nil, 0, 6, 'N/A', 3.5, '', 'three'].each do |bad_level|
    context "when the model returns level #{bad_level.inspect} for a discussed skill" do
      before do
        cover('System Design', state: 'partial', probe_count: 2)
        model_returns({ 'skill_label' => 'System Design', 'level' => bad_level, 'competency_summary' => 'Unclear.' })
      end

      it 'records insufficient evidence and never falls back to L1' do
        generate

        expect(skill('System Design')).to have_attributes(assessment_status: 'insufficient_evidence', ai_level: nil)
      end
    end
  end

  context 'when the model leaves out a discussed skill' do
    before do
      cover('System Design', state: 'covered', probe_count: 3)
      cover('Testing', state: 'initiated', probe_count: 1)
      model_returns({ 'skill_label' => 'System Design', 'level' => 3 })
    end

    it 'records insufficient evidence for the missing skill' do
      generate

      expect(skill('Testing')).to have_attributes(assessment_status: 'insufficient_evidence', ai_level: nil)
    end
  end

  context 'when the model returns messy evidence and unknown skills' do
    before do
      cover('System Design', state: 'covered', probe_count: 5)
      cover('Kubernetes', state: 'initiated', probe_count: 1, discovered: true)
      model_returns(
        { 'skill_label' => 'System Design', 'level' => 3, 'confidence' => 'very high',
          'evidence' => ['  first  ', 42, '', 'x' * 900, 'third', 'fourth'] },
        { 'skill_label' => 'Kubernetes', 'level' => 2 },
        { 'skill_label' => 'Invented Skill', 'level' => 5 }
      )
    end

    it 'keeps at most three trimmed string quotes of limited length' do
      generate

      evidence = skill('System Design').evidence
      expect(evidence.size).to eq(3)
      expect(evidence.first).to eq('first')
      expect(evidence.second.length).to eq(Portfolios::ResponseParser::MAX_QUOTE_LENGTH)
    end

    it 'ignores the model confidence and skills that were never in the coverage map' do
      generate

      expect(skill('System Design').ai_confidence).to eq('high')
      expect(skill('Kubernetes')).to have_attributes(is_discovered: true, ai_level: 2, ai_confidence: 'low')
      expect(session.portfolio.portfolio_skills.where(skill_label: 'Invented Skill')).to be_empty
    end
  end

  describe 'failures' do
    before { cover('System Design', state: 'covered', probe_count: 3) }

    it 'fails with a generic message when the model output is not JSON' do
      allow(gemini).to receive(:generate_content).and_return('Candidate said: "my salary is 30 juta" {broken')

      expect { generate }.to raise_error(Portfolios::ResponseParser::InvalidResponse)

      portfolio = session.reload.portfolio
      expect(portfolio.generation_status).to eq('failed')
      expect(portfolio.generation_error).not_to include('salary')
    end

    it 'fails with a timeout message when the model times out' do
      allow(gemini).to receive(:generate_content).and_raise(Gemini::HttpClient::TimeoutError.new('timeout after 180s'))

      expect { generate }.to raise_error(Gemini::HttpClient::TimeoutError)
      expect(session.reload.portfolio.generation_error).to eq('The AI model timed out')
    end

    it 'keeps the previous skills when saving the new ones fails halfway' do
      portfolio = create(:portfolio, session: session, generation_status: 'failed')
      previous = create(:portfolio_skill, portfolio: portfolio, skill_label: 'System Design', ai_level: 2)
      model_returns({ 'skill_label' => 'System Design', 'level' => 3 })
      allow(Portfolios::Confidence).to receive(:for).and_return('not-a-confidence')

      expect { generate }.to raise_error(ActiveRecord::RecordInvalid)

      expect(portfolio.reload.portfolio_skills).to contain_exactly(previous)
      expect(portfolio.generation_status).to eq('failed')
    end

    it 'does not log transcript content' do
      create(:transcript_turn, session: session, text: 'My home address is Jalan Contoh 12')
      allow(gemini).to receive(:generate_content).and_return('not json')
      allow(Rails.logger).to receive(:error)

      expect { generate }.to raise_error(Portfolios::ResponseParser::InvalidResponse)
      expect(Rails.logger).to have_received(:error).with(satisfy { |message| !message.include?('Jalan Contoh') })
    end
  end

  describe 'duplicate and stale jobs' do
    before do
      cover('System Design', state: 'covered', probe_count: 3)
      model_returns({ 'skill_label' => 'System Design', 'level' => 3 })
    end

    it 'does nothing when the portfolio is already complete' do
      create(:portfolio, session: session, generation_status: 'complete')

      generate

      expect(gemini).not_to have_received(:generate_content)
    end

    it 'does nothing when another job started generating recently' do
      create(:portfolio, session: session, generation_status: 'generating', generation_started_at: 1.minute.ago)

      generate

      expect(gemini).not_to have_received(:generate_content)
    end

    it 'takes over a portfolio stuck in generating' do
      create(:portfolio, session: session, generation_status: 'generating', generation_started_at: 20.minutes.ago)

      generate

      expect(session.reload.portfolio.generation_status).to eq('complete')
    end

    it 'does not create duplicate skills when run twice' do
      2.times { described_class.new(session: session.reload, gemini_client: gemini).call }

      expect(session.portfolio.portfolio_skills.where(skill_label: 'System Design').count).to eq(1)
      expect(gemini).to have_received(:generate_content).once
    end
  end
end
