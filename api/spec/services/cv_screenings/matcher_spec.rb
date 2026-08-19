# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CvScreenings::Matcher do
  let(:vacancy) { create(:vacancy, public_requirement_text: 'Must know Ruby.') }
  let(:vacancy_version) { vacancy.vacancy_versions.order(created_at: :desc).first }

  def build(response)
    described_class.new(
      vacancy_version: vacancy_version,
      cv_text:         'Fabricated CV text.',
      gemini_client:    stub_gemini_client(response)
    )
  end

  it 'returns a valid score in range' do
    result = build({ 'score' => 82, 'reasoning' => 'Strong match.' }).call

    expect(result).to be_ok
    expect(result.score).to eq(82)
    expect(result.reasoning).to eq('Strong match.')
  end

  it 'is model_failed for a non-numeric score' do
    result = build({ 'score' => 'high', 'reasoning' => 'x' }).call

    expect(result).not_to be_ok
    expect(result.status).to eq(:model_failed)
  end

  it 'is model_failed for an out-of-range score' do
    result = build({ 'score' => 150, 'reasoning' => 'x' }).call

    expect(result.status).to eq(:model_failed)
  end

  it 'is model_failed when the model call raises' do
    gemini_client = instance_double(Gemini::HttpClient)
    allow(gemini_client).to receive(:generate_content).and_raise(Gemini::HttpClient::ApiError.new('500'))

    result = described_class.new(vacancy_version: vacancy_version, cv_text: 'x', gemini_client: gemini_client).call

    expect(result.status).to eq(:model_failed)
  end
end
