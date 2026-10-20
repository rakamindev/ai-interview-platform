# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:assessment) { create(:assessment) }
  let!(:react) { create(:assessment_skill, assessment: assessment, skill_label: 'React', display_order: 1) }
  let!(:cloud) { create(:assessment_skill, assessment: assessment, skill_label: 'Cloud Infrastructure', display_order: 2) }
  let(:session) { create(:session, :ended, assessment: assessment) }

  let(:react_rating) do
    { 'skill_label' => 'React', 'level' => 3, 'confidence' => 'medium',
      'evidence' => ['I model loading and error states explicitly.'], 'competency_summary' => 'Handles UI state well.' }
  end

  before { create(:transcript_turn, session: session, speaker: 'candidate') }

  def generate(client)
    described_class.new(session: session, gemini_client: client).call
  end

  it 'stores rated skills and records unrated configured skills as not assessed' do
    portfolio = generate(FakeGeminiClient.new(response: { 'configured_skills' => [react_rating] }))

    expect(portfolio.generation_status).to eq('complete')
    skills = portfolio.portfolio_skills.order(:id)
    expect(skills.map { |s| [s.skill_label, s.ai_level, s.ai_confidence] })
      .to eq([['React', 3, 'medium'], ['Cloud Infrastructure', nil, nil]])
  end

  it 'asks the model to mark skills without evidence as not assessed rather than L1' do
    client = FakeGeminiClient.new(response: { 'configured_skills' => [react_rating] })
    generate(client)

    prompt = client.prompts.first[:prompt]
    expect(prompt).to include('"level": null')
    expect(prompt).to include('Never use L1 as a placeholder')
  end

  context 'when the candidate never spoke' do
    before { session.transcript_turns.delete_all }

    it 'records every configured skill as not assessed without calling the model' do
      client = FakeGeminiClient.new(response: { 'configured_skills' => [react_rating] })
      portfolio = generate(client)

      expect(client).not_to be_called
      expect(portfolio.portfolio_skills.pluck(:ai_level)).to eq([nil, nil])
      expect(portfolio.generation_status).to eq('complete')
    end
  end

  describe 'failure paths' do
    let!(:portfolio) { create(:portfolio, session: session, generation_status: 'failed') }
    let!(:previous) { create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 2) }
    let!(:override) { create(:assessor_override, portfolio_skill: previous, override_level: 4) }

    shared_examples 'keeps previous work and leaves the retry decision to Sidekiq' do
      it 're-raises so Sidekiq can retry' do
        expect { generate(client) }.to raise_error(StandardError)
      end

      it 'keeps the previous skills and the assessor override' do
        generate(client) rescue nil

        expect(PortfolioSkill.where(portfolio: portfolio).pluck(:id)).to eq([previous.id])
        expect(AssessorOverride.exists?(override.id)).to be(true)
      end

      it "stays 'generating' with the reason, instead of offering Retry while retries are queued" do
        generate(client) rescue nil

        expect(portfolio.reload.generation_status).to eq('generating')
        expect(portfolio.generation_error).to be_present
      end
    end

    context 'when Gemini is rate limited' do
      let(:client) { FakeGeminiClient.new(error: Gemini::HttpClient::RateLimitError.new('Rate limited')) }

      include_examples 'keeps previous work and leaves the retry decision to Sidekiq'
    end

    context 'when the model answers with prose instead of JSON' do
      let(:client) { FakeGeminiClient.new(response: 'I am unable to evaluate this interview.') }

      include_examples 'keeps previous work and leaves the retry decision to Sidekiq'
    end

    context 'when saving fails halfway through' do
      let(:client) { FakeGeminiClient.new(response: { 'configured_skills' => [react_rating] }) }

      before do
        calls = 0
        allow_any_instance_of(PortfolioSkill).to receive(:save!).and_wrap_original do |original, *args|
          calls += 1
          raise ActiveRecord::RecordNotSaved, 'simulated failure on the second skill' if calls == 2

          original.call(*args)
        end
      end

      include_examples 'keeps previous work and leaves the retry decision to Sidekiq'
    end
  end
end

RSpec.describe PortfolioGeneratorWorker do
  it "marks the portfolio 'failed' with the reason once retries are exhausted" do
    portfolio = create(:portfolio, generation_status: 'generating')
    handler = described_class.sidekiq_retries_exhausted_block

    handler.call({ 'args' => [portfolio.session_id], 'retry_count' => 3, 'error_message' => 'Rate limited' }, nil)

    expect(portfolio.reload.generation_status).to eq('failed')
    expect(portfolio.generation_error).to include('Rate limited')
  end
end
