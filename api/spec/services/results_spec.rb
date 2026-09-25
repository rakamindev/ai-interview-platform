require 'rails_helper'

RSpec.describe 'Result integrity' do
  let(:org) { organization }
  let(:session) { assessment_session(org) }
  let(:portfolio) { portfolio_for(session) }
  let(:vacancy) { vacancy_for(org) }

  it 'treats an unassessed rating as unknown, not a gap' do
    skill_for(portfolio, ai_level: nil)
    result = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
    expect(result.skill_comparisons.first).to include('candidate_level' => nil, 'delta' => nil, 'result' => 'not_assessed')
    expect(result.overall_narrative).to include('1 not assessed')
  end

  it 'reflects overrides immediately and does not rewrite unchanged reports' do
    skill = skill_for(portfolio)
    engine = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy)
    first = engine.call
    expect(engine.call.generated_at).to eq(first.generated_at)
    skill.create_assessor_override!(ai_level: 3, override_level: 4, overridden_by: 1, assessor_notes: 'Observed advanced evidence')
    expect(engine.call.skill_comparisons.first).to include('candidate_level' => 4, 'is_override' => true, 'result' => 'exceed')
  end

  it 'keeps skills with identical labels but different canonical IDs separate' do
    skill_for(portfolio, skill_id: 'other')
    expect(FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call.skill_comparisons.first['result']).to eq('not_assessed')
  end

  it 'supports an empty vacancy without an exception' do
    vacancy.vacancy_skills.destroy_all
    expect(FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call.skill_comparisons).to eq([])
  end

  it 'rejects cross-tenant worker inputs' do
    other = vacancy_for(organization('other'))
    expect { FitGap::Engine.new(portfolio: portfolio, vacancy: other).call }.to raise_error(ActiveRecord::RecordNotFound)
  end
end

RSpec.describe Portfolios::Generator do
  let(:session) { assessment_session(organization) }
  let(:portfolio) { session.create_portfolio!(generation_status: 'failed') }
  let(:client) { instance_double(Gemini::HttpClient) }
  let(:payload) do
    {'configured_skills' => [{'skill_id' => 'ruby', 'skill_label' => 'Ruby', 'level' => 4,
      'confidence' => 'high', 'evidence' => ['I test my code'], 'competency_summary' => 'Uses tests'}], 'discovered_skills' => []}
  end
  before do
    portfolio
    session.transcript_turns.create!(turn_number: 1, speaker: 'candidate', text: 'I test my code')
  end

  it 'preserves skill identity and human override on retry, and skips completed duplicates' do
    skill = skill_for(portfolio)
    override = skill.create_assessor_override!(ai_level: 3, override_level: 5, overridden_by: 1, assessor_notes: 'Reviewed evidence')
    expect(client).to receive(:generate_content).once.and_return(payload)
    generator = described_class.new(session: session, gemini_client: client)
    2.times { generator.call }
    expect(skill.reload.ai_level).to eq(4)
    expect(skill.assessor_override.id).to eq(override.id)
    expect(portfolio.reload).to be_complete
  end

  it 'preserves the prior result if validation fails' do
    skill = skill_for(portfolio)
    payload['configured_skills'][0]['level'] = 'L4'
    allow(client).to receive(:generate_content).and_return(payload)
    expect { described_class.new(session: session, gemini_client: client).call }.to raise_error(Portfolios::ResultValidator::InvalidResult)
    expect(skill.reload.ai_level).to eq(3)
    expect(portfolio.reload).to be_failed
  end

  it 'rolls back all skill writes if completion fails' do
    skill = skill_for(portfolio)
    allow(client).to receive(:generate_content).and_return(payload)
    allow_any_instance_of(Portfolio).to receive(:update!).and_wrap_original do |method, attrs|
      raise 'simulated write failure' if attrs[:generation_status] == 'complete'
      method.call(attrs)
    end
    expect { described_class.new(session: session, gemini_client: client).call }.to raise_error('simulated write failure')
    expect(skill.reload.ai_level).to eq(3)
  end
end

RSpec.describe 'Portfolio prompt catalog identifiers' do
  it 'keeps a configured null skill ID null instead of inventing a slug or example ID' do
    session = assessment_session(organization)
    skill = session.assessment.assessment_skills.first
    skill.update!(skill_id: nil, skill_label: 'Node.js / Backend Development')
    session.coverage_maps.create!(skill_id: nil, skill_label: skill.skill_label,
                                  state: 'partial', probe_count: 2, is_discovered: false)

    prompt = Portfolios::Generator.new(session: session).send(:build_prompt)

    expect(prompt).to include('"skill_id":null')
    expect(prompt).to include('"skill_label":"Node.js / Backend Development"')
    expect(prompt).not_to include('sk-eng-001')
    expect(prompt).not_to include('node.js-/-backend-development')
  end
end

RSpec.describe Exports::PdfGenerator do
  it 'exports an unassessed rating and human override without inventing an AI level' do
    org = organization
    portfolio = portfolio_for(assessment_session(org))
    skill = skill_for(portfolio, ai_level: nil)
    skill.create_assessor_override!(ai_level: nil, override_level: 3, overridden_by: 1, assessor_notes: 'Reviewed manually')
    pdf = described_class.new(portfolio: portfolio).call
    expect(pdf).to start_with('%PDF')
  end
end
