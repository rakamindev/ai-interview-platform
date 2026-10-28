# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:vacancy) do
    double('Vacancy', role_title: 'Fullstack Engineer',
                      culture_dimensions: nil, competency_expectations: nil)
  end
  let(:session)   { double('Session', assessment: double('Assessment')) }
  let(:portfolio) { double('Portfolio', session: session) }
  let(:failing_client) { double('GeminiClient') }

  before do
    allow(failing_client).to receive(:generate_content).and_raise(StandardError, 'model unavailable')
  end

  it 'flags unassessed skills in the fallback narrative when Gemini fails' do
    engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: failing_client)
    comparisons = [
      { skill_label: 'React', result: 'match' },
      { skill_label: 'Node', result: 'not_assessed' }
    ]

    narratives = engine.send(:generate_narratives, comparisons)

    expect(narratives[:overall]).to include('1 of 2')
    expect(narratives[:overall]).to include('incomplete')
  end
end
