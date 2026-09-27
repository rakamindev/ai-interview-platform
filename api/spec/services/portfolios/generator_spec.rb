# frozen_string_literal: true

require 'rails_helper'

# Data-safety contract for N10 (wiki 04-step4-revamp.md, AC-8/AC-9/AC-10).
# A failed or empty AI response must never (a) present as a "complete" 0-skill portfolio, or
# (b) destroy a previously-generated portfolio.
RSpec.describe Portfolios::Generator do
  let(:assessment) { create(:assessment) }
  let(:session)    { create(:session, assessment: assessment, tenant_id: assessment.tenant_id, status: 'ended') }
  let(:portfolio)  { session.create_portfolio!(generation_status: 'complete') }

  # A prior, good portfolio we must not lose on a later bad regeneration.
  before do
    portfolio.portfolio_skills.create!(
      skill_label: 'Existing Skill', ai_level: 3, ai_confidence: 'high', competency_summary: 'Prior good result.'
    )
  end

  def generate(response)
    client = instance_double(Gemini::HttpClient, generate_content: response)
    described_class.new(session: session, gemini_client: client).call
  end

  context 'empty AI response — AC-8 / F-AI-2' do
    it 'does not mark the portfolio complete with zero skills, and keeps the existing skills' do
      expect { generate({}) }.to raise_error(StandardError)

      expect(portfolio.reload.generation_status).to eq('failed')
      expect(portfolio.portfolio_skills.pluck(:skill_label)).to eq(['Existing Skill'])
    end
  end

  context 'invalid skill field (confidence casing) — AC-9 / F-AI-1' do
    let(:bad) do
      { 'configured_skills' => [
        { 'skill_label' => 'Node.js', 'level' => 4, 'confidence' => 'HIGH', # not in %w[high medium low]
          'evidence' => ['q'], 'competency_summary' => 'ok' }
      ] }
    end

    it 'rolls back the write so the previous portfolio survives' do
      expect { generate(bad) }.to raise_error(ActiveRecord::RecordInvalid)

      expect(portfolio.reload.portfolio_skills.pluck(:skill_label)).to eq(['Existing Skill'])
      expect(portfolio.generation_status).to eq('failed')
    end
  end

  context 'transient model error (timeout / rate limit) — AC-10' do
    [
      Gemini::HttpClient::TimeoutError.new('Gemini API timeout after 180s'),
      Gemini::HttpClient::RateLimitError.new('Rate limited', status: 429)
    ].each do |error|
      it "re-raises #{error.class.name.demodulize} so Sidekiq retries, and keeps the existing skills" do
        client = instance_double(Gemini::HttpClient)
        allow(client).to receive(:generate_content).and_raise(error)

        expect { described_class.new(session: session, gemini_client: client).call }.to raise_error(error.class)
        expect(portfolio.reload.portfolio_skills.pluck(:skill_label)).to eq(['Existing Skill'])
      end
    end
  end

  context 'valid response — AC-1 (no regression)' do
    let(:good) do
      { 'configured_skills' => [
        { 'skill_id' => 'x', 'skill_label' => 'Node.js', 'level' => 3, 'confidence' => 'high',
          'evidence' => %w[a b], 'competency_summary' => 'Solid backend reasoning.' }
      ] }
    end

    it 'replaces the skills and marks the portfolio complete' do
      generate(good)

      expect(portfolio.reload.generation_status).to eq('complete')
      expect(portfolio.portfolio_skills.pluck(:skill_label)).to eq(['Node.js'])
    end
  end
end
