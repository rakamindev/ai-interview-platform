# frozen_string_literal: true

require_relative '../../../app/services/fit_gap/engine'

RSpec.describe FitGap::Engine do
  it 'grounds the narrative in evidence and explicitly prevents automated hiring recommendations' do
    vacancy = Struct.new(:role_title, :culture_dimensions, :competency_expectations).new(
      'Frontend Engineer',
      'ownership and clear communication',
      'reliable delivery'
    )
    portfolio = Struct.new(:session).new(nil)
    engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: Object.new)

    low_confidence_gap = {
      skill_label: 'Communication',
      candidate_level: 2,
      expected_level: 3,
      delta: -1,
      confidence: 'low',
      overridden: false,
      competency_summary: 'Only one concrete example was observed.'
    }

    prompt = engine.send(:build_narrative_prompt, [low_confidence_gap], [], [], [])

    expect(prompt).to include('Do NOT recommend hire/reject')
    expect(prompt).to include('Treat "not assessed" as unknown evidence, never as a gap')
    expect(prompt).to include('confidence=low')
    expect(prompt).to include('Only one concrete example was observed.')
  end
end

RSpec.describe FitGap::Engine, 'failure handling' do
  it 'falls back to a deterministic evidence summary when the model call fails' do
    stub_const('Rails', Class.new)
    allow(Rails).to receive(:logger).and_return(double(error: nil))
    vacancy = Struct.new(:role_title, :culture_dimensions, :competency_expectations).new('Engineer', nil, nil)
    portfolio = Struct.new(:session).new(nil)
    gemini = Object.new
    def gemini.generate_content(*) = raise StandardError, 'model timeout'

    engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini)
    comparisons = [
      { skill_label: 'React', result: 'match', candidate_level: 3, expected_level: 3, confidence: 'high', overridden: false },
      { skill_label: 'System Design', result: 'not_assessed', candidate_level: nil, expected_level: 3, confidence: nil, overridden: false },
      { skill_label: 'Communication', result: 'gap', candidate_level: 2, expected_level: 3, confidence: 'low', overridden: false }
    ]

    narratives = engine.send(:generate_narratives, comparisons)

    expect(narratives[:culture]).to be_nil
    expect(narratives[:overall]).to include('1 matches')
    expect(narratives[:overall]).to include('1 gap')
    expect(narratives[:overall]).to include('1 required skill was not assessed')
    expect(narratives[:overall]).to include('1 comparison have low confidence')
  end
end
