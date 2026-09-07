# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  # Verified double instead of a hand-rolled fake: RSpec checks that
  # Gemini::HttpClient really does respond to generate_content with this signature,
  # so the spec cannot drift away from the real client. Nothing hits the network.
  def fake_client(response: nil, error: nil)
    instance_double(Gemini::HttpClient).tap do |client|
      if error
        allow(client).to receive(:generate_content).and_raise(error)
      else
        allow(client).to receive(:generate_content).and_return(response)
      end
    end
  end

  let(:assessment) { create(:assessment) }
  let(:session)    { create(:session, assessment: assessment) }

  before do
    create(:coverage_map, session: session, skill_id: 'sk-eng-001',
                          skill_label: 'React / Frontend Development', state: 'covered', probe_count: 3)
    create(:coverage_map, session: session, skill_id: 'sk-eng-002',
                          skill_label: 'System Design', state: 'not_yet', probe_count: 0)
  end

  def gemini_response(skills)
    { 'configured_skills' => skills, 'discovered_skills' => [] }
  end

  def skill(overrides = {})
    {
      'skill_id'           => 'sk-eng-001',
      'skill_label'        => 'React / Frontend Development',
      'level'              => 3,
      'confidence'         => 'high',
      'evidence'           => ['I usually reach for a reducer once the state branches.'],
      'competency_summary' => 'Consistent L3 behaviour across three probes.'
    }.merge(overrides)
  end

  describe 'skills that were never discussed' do
    it 'does not persist a score for a skill with coverage state not_yet' do
      client = fake_client(response: gemini_response([
        skill,
        skill('skill_id' => 'sk-eng-002', 'skill_label' => 'System Design', 'level' => 2)
      ]))

      portfolio = described_class.new(session: session, gemini_client: client).call

      expect(portfolio.portfolio_skills.pluck(:skill_id)).to eq(['sk-eng-001'])
      expect(portfolio).to be_complete
    end

    it 'persists nothing at all when the model rated only undiscussed skills' do
      client = fake_client(response: gemini_response([
        skill('skill_id' => 'sk-eng-002', 'skill_label' => 'System Design', 'level' => nil)
      ]))

      portfolio = described_class.new(session: session, gemini_client: client).call

      expect(portfolio.portfolio_skills).to be_empty
      expect(portfolio).to be_complete
    end
  end

  describe 'duplicate jobs' do
    it 'ignores a second run while a fresh attempt is still in flight' do
      portfolio = create(:portfolio, session: session, generation_status: 'generating',
                                     generation_started_at: Time.current)
      client = fake_client(response: gemini_response([skill]))

      described_class.new(session: session, gemini_client: client).call

      expect(client).not_to have_received(:generate_content)
      expect(portfolio.reload.generation_status).to eq('generating')
    end

    it 'reclaims a generating row whose worker died, instead of leaving it stuck' do
      portfolio = create(:portfolio, session: session, generation_status: 'generating',
                                     generation_started_at: 1.hour.ago, generation_attempts: 1)
      client = fake_client(response: gemini_response([skill]))

      described_class.new(session: session, gemini_client: client).call

      expect(client).to have_received(:generate_content).once
      expect(portfolio.reload).to be_complete
      expect(portfolio.generation_attempts).to eq(2)
    end
  end

  describe 'failure paths' do
    it 'marks the portfolio failed and re-raises when the model times out' do
      client = fake_client(error: Gemini::HttpClient::TimeoutError.new('Gemini API timeout after 180s'))

      expect { described_class.new(session: session, gemini_client: client).call }
        .to raise_error(Gemini::HttpClient::TimeoutError)

      portfolio = session.reload.portfolio
      expect(portfolio).to be_failed
      expect(portfolio.generation_error).to include('TimeoutError')
    end

    it 'fails with a generic reason when the model returns something that is not JSON' do
      client = fake_client(response: 'Sure! Here is the portfolio: <not json>')

      expect { described_class.new(session: session, gemini_client: client).call }
        .to raise_error(Portfolios::Generator::MalformedResponseError)

      expect(session.reload.portfolio.generation_error).to include('not valid JSON')
    end

    # UU PDP: whatever we persist must not carry transcript or candidate quotes.
    it 'truncates the persisted error so a model error cannot leak transcript text' do
      leaky = 'Candidate said: ' + ('a' * 5_000)
      client = fake_client(error: StandardError.new(leaky))

      expect { described_class.new(session: session, gemini_client: client).call }
        .to raise_error(StandardError)

      error = session.reload.portfolio.generation_error
      expect(error.length).to be <= Portfolios::Generator::MAX_ERROR_CHARS + 40
    end

    it 'keeps the previous skills when a write fails halfway through' do
      portfolio = create(:portfolio, session: session, generation_status: 'complete')
      existing = portfolio.portfolio_skills.create!(
        skill_id: 'sk-eng-001', skill_label: 'React / Frontend Development',
        is_discovered: false, ai_level: 2, ai_confidence: 'medium',
        evidence: [], competency_summary: 'Previous run.'
      )

      client = fake_client(response: gemini_response([skill]))
      allow_any_instance_of(PortfolioSkill).to receive(:save!)
        .and_raise(ActiveRecord::RecordInvalid.new(PortfolioSkill.new))

      expect { described_class.new(session: session, gemini_client: client).call }
        .to raise_error(ActiveRecord::RecordInvalid)

      # destroy_all and create! share one transaction, so the old set is still intact.
      expect(portfolio.reload.portfolio_skills.pluck(:id)).to eq([existing.id])
      expect(portfolio).to be_failed
    end
  end
end
