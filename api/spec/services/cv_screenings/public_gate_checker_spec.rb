# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CvScreenings::PublicGateChecker do
  def build(response)
    described_class.new(
      public_requirement_text: 'Must have 3+ years of Ruby experience.',
      cv_text:                 'Fabricated CV text.',
      gemini_client:            stub_gemini_client(response)
    )
  end

  it 'passes when the model returns passes: true' do
    result = build({ 'passes' => true, 'reasoning' => 'Meets requirements.' }).call

    expect(result).to be_passed
  end

  it 'fails when the model returns passes: false' do
    result = build({ 'passes' => false, 'reasoning' => 'Missing required experience.' }).call

    expect(result).to be_failed
  end

  it 'is model_failed, never a rejection, when the response is malformed' do
    result = build({ 'unexpected' => 'shape' }).call

    expect(result).to be_model_failed
  end

  it 'is model_failed, never a rejection, when the model call raises' do
    gemini_client = instance_double(Gemini::HttpClient)
    allow(gemini_client).to receive(:generate_content).and_raise(Gemini::HttpClient::TimeoutError.new('timeout'))

    checker = described_class.new(public_requirement_text: 'x', cv_text: 'y', gemini_client: gemini_client)

    expect(checker.call).to be_model_failed
  end
end
