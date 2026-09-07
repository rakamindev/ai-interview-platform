# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:assessment) { create(:assessment, :with_prd02_skills) }
  let(:session)    { create(:session, :ended, assessment: assessment) }
  let(:client)     { instance_double(Gemini::HttpClient) }

  subject(:generator) { described_class.new(session: session, gemini_client: client) }

  let(:model_response) do
    {
      'configured_skills' => [
        { 'skill_id' => 'SK-ENG-001', 'skill_label' => 'React / Frontend Development Core',
          'level' => 3, 'confidence' => 'high',
          'evidence' => ['"quote one"', '"quote two"', '"quote three"', '"quote four"'],
          'competency_summary' => 'Consistently handles complex state architecture.' }
      ],
      'discovered_skills' => [
        { 'skill_label' => 'Micro-frontends', 'level' => 2, 'confidence' => 'low',
          'evidence' => ['"quote"'], 'competency_summary' => 'Briefly explored.' }
      ]
    }
  end

  before do
    create(:transcript_turn, session: session, turn_number: 1, speaker: 'candidate', text: 'An answer.')
    create(:coverage_map, session: session, skill_label: 'React / Frontend Development Core',
                          skill_id: 'SK-ENG-001', state: 'covered', probe_count: 4)
  end

  # AC-3. The product's premise is that levels are comparable between
  # candidates. Two runs over the same transcript and the same coverage map
  # returned Communication L3 and then L2 — one level, which is the whole
  # distance between `Match` and `Gap -1` in FitGap::Engine. A rating that
  # moves on re-run cannot support a hiring decision.
  describe 'determinism' do
    it 'asks the model for a deterministic reading of fixed evidence' do
      expect(client).to receive(:generate_content).with(anything, temperature: 0).and_return(model_response)

      generator.call
    end
  end

  describe 'persisting the reading' do
    before { allow(client).to receive(:generate_content).and_return(model_response) }

    it 'marks the portfolio complete and timestamps it' do
      portfolio = generator.call

      expect(portfolio).to be_complete
      expect(portfolio.generated_at).to be_present
    end

    it 'keeps at most the three most revealing quotes' do
      skill = generator.call.portfolio_skills.find_by(skill_id: 'SK-ENG-001')

      expect(skill.evidence.size).to eq(3)
    end

    it 'separates discovered skills from the configured agenda' do
      portfolio = generator.call

      expect(portfolio.portfolio_skills.where(is_discovered: true).pluck(:skill_label)).to eq(['Micro-frontends'])
    end

    it 'is idempotent — regenerating leaves one row per skill, not two' do
      generator.call
      portfolio = generator.call

      expect(portfolio.portfolio_skills.count).to eq(2)
    end
  end

  # The most expensive defect this product can carry, because nothing about the
  # result looks wrong. `nil.to_i` is 0, `.clamp(1, 5)` lifts it to 1, and a
  # skill the interview never reached was filed as "L1, Foundational" against a
  # real person, indistinguishable on screen from a level they earned.
  describe 'a skill the interview never reached' do
    def response_with_level(level)
      r = model_response.deep_dup
      r['configured_skills'][0]['level'] = level
      r['discovered_skills'] = []
      r
    end

    it 'records no level rather than inventing one' do
      allow(client).to receive(:generate_content).and_return(response_with_level(nil))

      skill = generator.call.portfolio_skills.find_by(skill_id: 'SK-ENG-001')

      expect(skill.ai_level).to be_nil
      expect(skill).not_to be_assessed
    end

    it 'does not quietly become L1' do
      allow(client).to receive(:generate_content).and_return(response_with_level(nil))

      expect(generator.call.portfolio_skills.find_by(skill_id: 'SK-ENG-001').ai_level).not_to eq(1)
    end

    it 'treats an empty string the same way' do
      allow(client).to receive(:generate_content).and_return(response_with_level(''))

      expect(generator.call.portfolio_skills.find_by(skill_id: 'SK-ENG-001').ai_level).to be_nil
    end

    it 'treats unparseable junk the same way rather than guessing' do
      allow(client).to receive(:generate_content).and_return(response_with_level('not a level'))

      expect(generator.call.portfolio_skills.find_by(skill_id: 'SK-ENG-001').ai_level).to be_nil
    end

    it 'still reads a level sent as a numeric string' do
      allow(client).to receive(:generate_content).and_return(response_with_level('4'))

      expect(generator.call.portfolio_skills.find_by(skill_id: 'SK-ENG-001').ai_level).to eq(4)
    end

    it 'keeps a real level assessed' do
      allow(client).to receive(:generate_content).and_return(response_with_level(3))

      expect(generator.call.portfolio_skills.find_by(skill_id: 'SK-ENG-001')).to be_assessed
    end
  end

  describe 'defending against implausible model output' do
    it 'clamps a level outside L1-L5 rather than storing it' do
      response = model_response.deep_dup
      response['configured_skills'][0]['level'] = 9
      allow(client).to receive(:generate_content).and_return(response)

      expect(generator.call.portfolio_skills.find_by(skill_id: 'SK-ENG-001').ai_level).to eq(5)
    end

    it 'clamps a level below L1 too' do
      response = model_response.deep_dup
      response['configured_skills'][0]['level'] = 0
      allow(client).to receive(:generate_content).and_return(response)

      expect(generator.call.portfolio_skills.find_by(skill_id: 'SK-ENG-001').ai_level).to eq(1)
    end
  end

  # AC-5, and the brief's "duplicate jobs" failure path. save_skills begins with
  # portfolio_skills.destroy_all, and PortfolioSkill has_one :assessor_override,
  # dependent: :destroy — so a second run racing the first does not merely waste
  # a Gemini call, it can delete an assessor's correction and their notes. Two
  # concurrent runs were observed doing exactly that, replacing portfolio_skill
  # ids 1-5 with 6-10 while both reported success.
  describe 'when a generation is already running' do
    before do
      allow(client).to receive(:generate_content).and_return(model_response)
      session.create_portfolio!(candidate_id: session.candidate_id, generation_status: 'generating')
    end

    it 'declines to start a second one' do
      expect(client).not_to receive(:generate_content)

      generator.call
    end

    it 'leaves the in-flight portfolio untouched' do
      expect(generator.call.generation_status).to eq('generating')
    end

    it 'does not destroy an assessor override belonging to the running generation' do
      skill = create(:portfolio_skill, portfolio: session.portfolio)
      create(:assessor_override, portfolio_skill: skill)

      generator.call

      expect(AssessorOverride.count).to eq(1)
    end
  end

  describe 'when the model call fails' do
    before { allow(client).to receive(:generate_content).and_raise(Gemini::HttpClient::ApiError, 'API returned 503') }

    it 'records the failure on the portfolio instead of leaving it half-written' do
      expect { generator.call }.to raise_error(Gemini::HttpClient::ApiError)

      portfolio = session.reload.portfolio
      expect(portfolio).to be_failed
      expect(portfolio.generation_error).to include('503')
    end

    it 'leaves no partial skills behind' do
      expect { generator.call }.to raise_error(Gemini::HttpClient::ApiError)

      expect(session.reload.portfolio.portfolio_skills).to be_empty
    end
  end
end
