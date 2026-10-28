# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  include InterviewHelpers

  let!(:interview) { create_interview }
  let(:session)     { interview.session }
  let(:portfolio)   { session.portfolio || session.create_portfolio!(generation_status: 'pending') }

  it 'uses the offline mock client in the test environment' do
    expect(Gemini.mode).to eq(:mock)
    expect(Gemini.client(:portfolio)).to be_a(Gemini::MockClient)
  end

  describe 'duplicate delivery' do
    it 'skips a run while another worker holds a fresh claim' do
      portfolio.update!(generation_status: 'generating', generation_started_at: Time.current)

      result = described_class.new(session: session).call

      expect(result.id).to eq(portfolio.id)
      expect(result.reload.generation_status).to eq('generating')
      expect(result.portfolio_skills).to be_empty
    end
  end

  describe 'a stale claim' do
    before do
      portfolio.update!(generation_status: 'generating', generation_started_at: 20.minutes.ago)
    end

    it 'is taken over and completes with every covered skill rated' do
      result = described_class.new(session: session).call
      result.reload

      expect(result.generation_status).to eq('complete')
      expect(result.generated_at).to be_present
      expect(result.portfolio_skills.where(is_discovered: false).map(&:skill_label))
        .to contain_exactly('React / Frontend Development')
      expect(result.portfolio_skills.all? { |skill| skill.ai_level.between?(1, 5) }).to be(true)
      expect(result.portfolio_skills.map(&:ai_confidence)).to all(satisfy { |c| %w[high medium low].include?(c) })
    end
  end

  describe 'an unusable model payload' do
    let(:bad_client) do
      Class.new do
        def generate_content(*_args, **_kwargs)
          'definitely not json'
        end
      end.new
    end

    before do
      portfolio.update!(generation_status: 'generating', generation_started_at: 20.minutes.ago)
      described_class.new(session: session).call
      portfolio.reload.update!(generation_status: 'failed', generation_error: nil)
    end

    it 'marks the portfolio failed instead of claiming success' do
      expect { described_class.new(session: session, gemini_client: bad_client).call }
        .to raise_error(Gemini::Errors::InvalidResponseError)

      portfolio.reload
      expect(portfolio.generation_status).to eq('failed')
      expect(portfolio.generation_error).to be_present
    end

    it 'never stores transcript text in the failure message' do
      expect { described_class.new(session: session, gemini_client: bad_client).call }
        .to raise_error(Gemini::Errors::InvalidResponseError)

      expect(portfolio.reload.generation_error.downcase).not_to include('dashboard')
    end

    it 'keeps the previous portfolio intact' do
      expect { described_class.new(session: session, gemini_client: bad_client).call }
        .to raise_error(Gemini::Errors::InvalidResponseError)

      expect(portfolio.reload.portfolio_skills).not_to be_empty
    end
  end
end
