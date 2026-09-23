# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  subject(:generator) do
    described_class.new(
      session: session,
      gemini_client: primary_client,
      fallback_client: fallback_client
    )
  end

  let(:primary_client) { instance_double(Gemini::HttpClient, model: 'gemini-pro-test') }
  let(:fallback_client) { instance_double(Gemini::HttpClient, model: 'gemini-flash-test') }

  let(:portfolio_skills) { instance_double(ActiveRecord::Associations::CollectionProxy) }
  let(:portfolio) do
    instance_double(
      Portfolio,
      portfolio_skills: portfolio_skills
    )
  end

  let(:assessment) do
    instance_double(
      Assessment,
      name: 'Backend Engineer',
      assessment_skills: double(order: [])
    )
  end

  let(:session) do
    instance_double(
      Session,
      id: 42,
      candidate_id: 7,
      portfolio: portfolio,
      assessment: assessment,
      coverage_maps: double(order: []),
      transcript_turns: double(ordered: [])
    )
  end

  let(:model_payload) do
    {
      'configured_skills' => [
        {
          'skill_id' => 'SK-ENG-001',
          'skill_label' => 'React',
          'level' => 3,
          'confidence' => 'high',
          'evidence' => ['built components'],
          'competency_summary' => 'Builds UI with review.'
        }
      ],
      'discovered_skills' => []
    }
  end

  before do
    allow(portfolio).to receive(:update!)
    allow(portfolio_skills).to receive(:destroy_all)
    allow(portfolio_skills).to receive(:create!)
  end

  describe '#call' do
    it 'falls back to Flash when Pro is rate-limited and completes the portfolio' do
      allow(primary_client).to receive(:generate_content)
        .and_raise(Gemini::HttpClient::RateLimitError.new('Rate limited', status: 429))
      allow(fallback_client).to receive(:generate_content).and_return(model_payload)

      result = generator.call

      expect(result).to eq(portfolio)
      expect(portfolio).to have_received(:update!).with(hash_including(generation_status: 'generating')).ordered
      expect(portfolio).to have_received(:update!).with(
        hash_including(generation_status: 'complete', generation_error: nil)
      ).ordered
      expect(fallback_client).to have_received(:generate_content)
      expect(portfolio_skills).to have_received(:create!).with(hash_including(skill_label: 'React'))
    end

    it 'marks the portfolio failed when Pro and Flash are both rate-limited without re-raising' do
      allow(primary_client).to receive(:generate_content)
        .and_raise(Gemini::HttpClient::RateLimitError.new('Rate limited', status: 429))
      allow(fallback_client).to receive(:generate_content)
        .and_raise(Gemini::HttpClient::RateLimitError.new('Rate limited', status: 429))

      expect { generator.call }.not_to raise_error

      expect(portfolio).to have_received(:update!).with(
        generation_status: 'failed',
        generation_error: described_class::MODELS_EXHAUSTED_ERROR
      )
    end

    it 'does not call a fallback when Pro succeeds' do
      allow(primary_client).to receive(:generate_content).and_return(model_payload)
      allow(fallback_client).to receive(:generate_content)

      generator.call

      expect(fallback_client).not_to have_received(:generate_content)
      expect(portfolio).to have_received(:update!).with(
        hash_including(generation_status: 'complete')
      )
    end

    it 'fails closed when rate-limited and no fallback client is configured' do
      generator_without_fallback = described_class.new(
        session: session,
        gemini_client: primary_client,
        fallback_client: nil
      )

      allow(primary_client).to receive(:generate_content)
        .and_raise(Gemini::HttpClient::RateLimitError.new('Rate limited', status: 429))

      expect { generator_without_fallback.call }.not_to raise_error

      expect(portfolio).to have_received(:update!).with(
        generation_status: 'failed',
        generation_error: described_class::MODELS_EXHAUSTED_ERROR
      )
    end
  end
end
