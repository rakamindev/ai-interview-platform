# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Narrator do
  let(:scenario) { build_fit_gap_scenario }
  let(:inputs) { FitGap::Inputs.new(portfolio: scenario[:portfolio], vacancy: scenario[:vacancy]) }
  let(:result) { FitGap::Comparator.new(requirements: inputs.requirements, ratings: inputs.ratings).call }

  def narrate(client) = described_class.new(inputs:, client:).call(result)

  it 'uses the model narrative when it returns valid JSON' do
    narrative = narrate(fake_model(ai_narrative))

    expect(narrative.to_h).to eq(culture: 'Strong ownership signals.', overall: 'Probe async communication next.',
                                 source: 'ai')
  end

  it 'accepts the model JSON as a string' do
    expect(narrate(fake_model(ai_narrative.to_json)).source).to eq('ai')
  end

  it 'allows a missing culture paragraph' do
    narrative = narrate(fake_model({ 'overall_narrative' => 'Overall fine.' }))

    expect(narrative.to_h).to include(culture: nil, overall: 'Overall fine.', source: 'ai')
  end

  it 'truncates runaway output' do
    narrative = narrate(fake_model({ 'overall_narrative' => 'x' * 5_000 }))

    expect(narrative.overall.length).to eq(described_class::MAX_NARRATIVE_LENGTH)
    expect(narrative.overall).to end_with('…')
  end

  describe 'model failures fall back to a deterministic summary (AC12)' do
    {
      'timeout' => { error: Gemini::HttpClient::TimeoutError.new('timeout') },
      'HTTP error' => { error: Gemini::HttpClient::ApiError.new('API returned 503', status: 503) },
      'missing API key' => { error: KeyError.new('key not found: "GEMINI_API_KEY"') },
      'prose instead of JSON' => { response: 'Sure! Here is the narrative you asked for.' },
      'empty object' => { response: {} },
      'array' => { response: [1, 2] },
      'blank overall' => { response: { 'overall_narrative' => '   ' } },
      'non-string overall' => { response: { 'overall_narrative' => { 'nested' => true } } }
    }.each do |name, failure|
      it "on #{name}" do
        narrative = narrate(fake_model(failure[:response], error: failure[:error]))

        expect(narrative.source).to eq('fallback')
        expect(narrative.culture).to be_nil
        expect(narrative.overall).to include('meets 1, exceeds 1 and is below the expected level on 1')
      end
    end

    it 'names unassessed skills and says missing evidence is not a gap' do
      narrative = narrate(fake_model(error: Gemini::HttpClient::TimeoutError.new('t')))

      expect(narrative.overall).to include('1 skill could not be assessed (Kubernetes)')
      expect(narrative.overall).to include('missing evidence is not evidence of a gap')
    end

    it 'flags low-confidence ratings and lists areas to probe' do
      narrative = narrate(fake_model(error: Gemini::HttpClient::TimeoutError.new('t')))

      expect(narrative.overall).to include('1 rating rests on limited evidence')
      expect(narrative.overall).to include('Areas to probe in the next conversation: Communication.')
    end

    it 'does not log exception messages that could contain candidate data' do
      allow(Rails.logger).to receive(:warn)
      narrate(fake_model(error: Gemini::HttpClient::ApiError.new('echo: Kandidat Fiktif said ...')))

      expect(Rails.logger).to have_received(:warn).with(a_string_including('Gemini::HttpClient::ApiError'))
      expect(Rails.logger).not_to have_received(:warn).with(a_string_including('Kandidat'))
    end

    it 'falls back when the API key is not configured at all' do
      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with('GEMINI_API_KEY').and_raise(KeyError)

      expect(described_class.new(inputs:).call(result).source).to eq('fallback')
    end
  end

  describe 'prompt (AC23)' do
    let(:client) { fake_model(ai_narrative) }

    before { narrate(client) }

    def prompt
      prompt = nil
      expect(client).to have_received(:generate_content) { |p, **| prompt = p }
      prompt
    end

    it 'asks for areas to probe, never a hiring recommendation' do
      expect(prompt).to include('You do NOT decide whether to hire')
      expect(prompt).to include('Do not recommend hiring or rejecting')
    end

    it 'includes competency summaries and uncertainty markers' do
      expect(prompt).to include('Evidence summary: Consistent, evidence-backed behaviour')
      expect(prompt).to include('Communication: expected L3, candidate L2, gap, needs verification')
      expect(prompt).to include('Kubernetes: expected L2, candidate —, not assessed')
    end

    it 'does not include the candidate name' do
      expect(prompt).not_to include(scenario[:portfolio].session.candidate_name)
    end
  end
end
