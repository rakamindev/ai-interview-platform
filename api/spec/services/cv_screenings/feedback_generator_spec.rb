# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CvScreenings::FeedbackGenerator do
  it 'returns the generated feedback text' do
    generator = described_class.new(
      public_requirement_text: 'Must know Ruby.',
      gemini_client:            stub_gemini_client({ 'feedback' => 'Thanks for applying!' })
    )

    expect(generator.call).to eq('Thanks for applying!')
  end

  it 'falls back to generic copy, never raising, when the model call fails' do
    gemini_client = instance_double(Gemini::HttpClient)
    allow(gemini_client).to receive(:generate_content).and_raise(Gemini::HttpClient::TimeoutError.new('timeout'))

    generator = described_class.new(public_requirement_text: 'Must know Ruby.', gemini_client: gemini_client)

    expect { generator.call }.not_to raise_error
    expect(generator.call).to include('Thank you for your interest')
  end

  it "never receives a threshold, score, or private criteria — structurally, not just by convention" do
    expect(described_class.instance_method(:initialize).parameters).to eq(
      [%i[keyreq public_requirement_text], %i[key gemini_client]]
    )
  end
end
