# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:organization) do
    Organization.create!(name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp', host: 'test.example.test')
  end
  let(:assessment) do
    Assessment.unscoped.create!(
      tenant_id: organization.id, created_by: 1, name: 'Generator', time_limit_min: 45, language: 'en'
    )
  end
  let(:session) do
    Session.unscoped.create!(tenant_id: organization.id, assessment: assessment, status: 'ended', end_reason: 'error')
  end
  let(:gemini_client) { instance_double(Gemini::HttpClient) }
  let(:generator) { described_class.new(session: session, gemini_client: gemini_client) }

  before do
    session.create_portfolio!(generation_status: 'pending')
    allow(gemini_client).to receive(:generate_content).and_return(
      { 'configured_skills' => [], 'discovered_skills' => [] }
    )
  end

  shared_examples 'a session with nothing to assess (T5)' do
    it 'does not ask the AI to assess it' do
      generator.call

      expect(gemini_client).not_to have_received(:generate_content)
    end

    it 'records why there is no portfolio, without raising so Sidekiq does not retry' do
      expect { generator.call }.not_to raise_error

      expect(session.portfolio.reload).to have_attributes(
        generation_status: 'failed',
        generation_error: Portfolio::NO_CANDIDATE_ANSWERS
      )
    end
  end

  context 'with no transcript at all' do
    it_behaves_like 'a session with nothing to assess (T5)'
  end

  context 'with only the AI speaking (sessions 9 and 13)' do
    before { session.transcript_turns.create!(turn_number: 1, speaker: 'ai', text: 'Hello, tell me about you.') }

    it_behaves_like 'a session with nothing to assess (T5)'
  end

  context 'with at least one candidate answer' do
    before { session.transcript_turns.create!(turn_number: 1, speaker: 'candidate', text: 'I built a queue.') }

    it 'generates the portfolio' do
      generator.call

      expect(gemini_client).to have_received(:generate_content)
      expect(session.portfolio.reload.generation_status).to eq('complete')
    end
  end
end
