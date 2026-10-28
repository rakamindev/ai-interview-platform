# frozen_string_literal: true

require 'rails_helper'

# Failure paths of portfolio generation: malformed model output, model call
# errors, partial writes and concurrent jobs.
RSpec.describe Portfolios::Generator do
  let(:assessment)        { create(:assessment) }
  let(:interview_session) { create(:session, assessment: assessment, candidate_name: 'Kandidat Contoh Rahasia') }
  let(:transcript_text)   { 'Contoh jawaban rahasia tentang migrasi.' }

  let(:valid_response) do
    {
      'configured_skills' => [
        { 'skill_label' => 'Ruby on Rails', 'level' => 3, 'evidence' => ['Kandidat Contoh: kutipan A.'],
          'competency_summary' => 'Contoh A.' },
        { 'skill_label' => 'API Design', 'level' => 2, 'evidence' => ['Kandidat Contoh: kutipan B.'],
          'competency_summary' => 'Contoh B.' }
      ],
      'discovered_skills' => []
    }
  end

  before do
    create(:assessment_skill, assessment: assessment, skill_label: 'Ruby on Rails')
    create(:coverage_map, session: interview_session, skill_label: 'Ruby on Rails')
    create(:coverage_map, session: interview_session, skill_label: 'API Design')
    create(:transcript_turn, session: interview_session, turn_number: 1, text: transcript_text)
  end

  def generate(client)
    described_class.new(session: interview_session, gemini_client: client).call
  end

  def portfolio
    interview_session.reload.portfolio
  end

  it 'marks a skill whose coverage is not_yet as not assessed even if the model rated it (AC-01)' do
    create(:coverage_map, session: interview_session, skill_label: 'System Design', state: 'not_yet', probe_count: 0)
    response = valid_response.deep_dup
    response['configured_skills'] << { 'skill_label' => 'System Design', 'level' => 4,
                                       'evidence' => ['Kandidat Contoh: x.'], 'competency_summary' => 'x' }

    generate(FakeGeminiClient.new(response))

    expect(portfolio.portfolio_skills.find_by!(skill_label: 'System Design'))
      .to have_attributes(rating_status: 'not_assessed', not_assessed_reason: 'not_covered', ai_level: nil)
  end

  describe 'malformed model output (AC-08)' do
    {
      'truncated JSON' => ['{"configured_skills": [{"skill_label": "Ruby', 'invalid_output'],
      'empty string' => ['', 'empty_output'],
      'nil' => [nil, 'empty_output'],
      'object without configured_skills' => [{ 'discovered_skills' => [] }, 'invalid_output'],
      'configured_skills not a list' => [{ 'configured_skills' => 'Ruby on Rails' }, 'invalid_output']
    }.each do |name, (response, code)|
      it "fails with #{code} and writes no skills for #{name}" do
        generate(FakeGeminiClient.new(response))

        expect(portfolio).to have_attributes(generation_status: 'failed', generation_error_code: code)
        expect(portfolio.portfolio_skills).to be_empty
      end
    end
  end

  it 'rolls back all skill writes when the database fails mid-write (AC-09)' do
    generate(FakeGeminiClient.new(valid_response))
    previous = portfolio.portfolio_skills.order(:id).pluck(:skill_label, :ai_level)

    saves = 0
    allow_any_instance_of(PortfolioSkill).to receive(:save!).and_wrap_original do |original, *args, **options|
      saves += 1
      raise ActiveRecord::StatementInvalid, 'simulated failure' if saves == 2

      original.call(*args, **options)
    end

    expect { generate(FakeGeminiClient.new(valid_response)) }.to raise_error(ActiveRecord::StatementInvalid)
    expect(portfolio.portfolio_skills.order(:id).pluck(:skill_label, :ai_level)).to eq(previous)
    expect(portfolio).to have_attributes(generation_status: 'failed', generation_error_code: 'unknown')
  end

  describe 'model call failures (AC-10)' do
    {
      'timeout' => [Gemini::HttpClient::TimeoutError.new('Gemini API timeout after 180s'), 'timeout', true],
      'rate limit' => [Gemini::HttpClient::RateLimitError.new('Rate limited', status: 429), 'rate_limited', true],
      'unavailable' => [Gemini::HttpClient::ApiError.new('API returned 503', status: 503), 'provider_unavailable', true],
      'denied' => [Gemini::HttpClient::ApiError.new('API returned 403', status: 403), 'provider_denied', false]
    }.each do |name, (error, code, retryable)|
      it "records #{code} for a #{name} error and #{retryable ? 're-raises for retry' : 'does not retry'}" do
        call = -> { generate(FakeGeminiClient.new(nil, error: error)) }

        retryable ? expect(&call).to(raise_error(error.class)) : expect(&call).not_to(raise_error)
        expect(portfolio).to have_attributes(generation_status: 'failed', generation_error_code: code)
      end
    end

    it 'never logs the transcript, the candidate name or the raw error message' do
      logged = []
      allow(Rails.logger).to receive(:error) { |message| logged << message.to_s }
      allow(Rails.logger).to receive(:info) { |message| logged << message.to_s }
      error = Gemini::HttpClient::ApiError.new("API returned 403: #{transcript_text}", status: 403)

      generate(FakeGeminiClient.new(nil, error: error))

      expect(logged.join("\n")).not_to include(transcript_text)
      expect(logged.join("\n")).not_to include('Kandidat Contoh Rahasia')
      expect(logged.join("\n")).to include('provider_denied')
    end
  end

  it 'does not call the model when another job is already generating the portfolio (AC-13)' do
    create(:portfolio, session: interview_session, generation_status: 'generating', generated_at: nil,
                       generation_claimed_at: 1.minute.ago)
    client = FakeGeminiClient.new(valid_response)

    generate(client)

    expect(client.calls).to be_empty
    expect(portfolio.reload.generation_status).to eq('generating')
  end

  # A job killed mid-run must not lock the portfolio forever: a claim older
  # than the claim timeout (2x the Gemini timeout) can be taken over.
  describe 'stale generation claims' do
    it 'takes over a claim older than the claim timeout and completes the portfolio' do
      stale_at = (described_class::CLAIM_TIMEOUT + 1.minute).ago
      create(:portfolio, session: interview_session, generation_status: 'generating', generation_claimed_at: stale_at)
      client = FakeGeminiClient.new(valid_response)

      generate(client)

      expect(client.calls.size).to eq(1)
      expect(portfolio).to have_attributes(generation_status: 'complete')
      expect(portfolio.generation_claimed_at).to be > 1.minute.ago
    end

    it 'keeps a claim that is just inside the claim timeout' do
      recent_at = (described_class::CLAIM_TIMEOUT - 1.minute).ago
      create(:portfolio, session: interview_session, generation_status: 'generating', generation_claimed_at: recent_at)
      client = FakeGeminiClient.new(valid_response)

      generate(client)

      expect(client.calls).to be_empty
    end

    it 'takes over a generating portfolio that has no claim time (stuck before claims were recorded)' do
      create(:portfolio, session: interview_session, generation_status: 'generating', generation_claimed_at: nil)
      client = FakeGeminiClient.new(valid_response)

      generate(client)

      expect(client.calls.size).to eq(1)
      expect(portfolio.generation_status).to eq('complete')
    end

    it 'sets the claim timeout to twice the Gemini request timeout' do
      expect(described_class::CLAIM_TIMEOUT).to eq(2 * described_class::GEMINI_TIMEOUT)
    end
  end

  it 'marks a newly generated portfolio as validated (AC-14)' do
    generate(FakeGeminiClient.new(valid_response))

    expect(portfolio).to have_attributes(generation_status: 'complete', ratings_validated: true,
                                         generation_error_code: nil)
  end
end
