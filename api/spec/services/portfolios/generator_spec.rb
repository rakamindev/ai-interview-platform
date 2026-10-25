require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:portfolio) { create_review.first }
  let(:session) { portfolio.session }
  let(:valid_skill) { { 'skill_id' => 'SK-ENG-004', 'skill_label' => 'Database design', 'level' => 4, 'confidence' => 'high', 'evidence' => ['Synthetic quote'], 'competency_summary' => 'Synthetic summary' } }

  def generate(data)
    portfolio.update!(generation_status: 'failed')
    client = instance_double(Gemini::HttpClient, generate_content: data)
    described_class.new(session: session, gemini_client: client).call
  end

  it 'does not turn a missing rating into L1' do
    result = generate('configured_skills' => [valid_skill.merge('level' => nil)])
    expect(result).to be_complete
    expect(result.portfolio_skills).to be_empty
  end

  it 'rejects malformed levels and preserves the prior skills' do
    original = add_rating(portfolio)
    expect { generate('configured_skills' => [valid_skill.merge('level' => 'unknown')]) }.to raise_error(ArgumentError)
    expect(portfolio.reload.portfolio_skills.pluck(:id)).to eq([original.id])
    expect(portfolio).to be_failed
  end

  it 'rejects a non-text summary rather than displaying an object as evidence' do
    original = add_rating(portfolio)
    expect { generate('configured_skills' => [valid_skill.merge('competency_summary' => {})]) }.to raise_error(ArgumentError)
    expect(original.reload.competency_summary).to eq('Synthetic evidence for a local review.')
  end

  it 'rolls back a partially valid response' do
    original = add_rating(portfolio)
    expect { generate('configured_skills' => [valid_skill, valid_skill.merge('skill_id' => 'another', 'confidence' => 'invented')]) }.to raise_error(ActiveRecord::RecordInvalid)
    expect(original.reload.ai_level).to eq(3)
    expect(portfolio.portfolio_skills.count).to eq(1)
  end

  it 'preserves human review records during regeneration' do
    original = add_rating(portfolio)
    revision = original.create_assessor_override!(ai_level: 3, override_level: 5, overridden_by: 1)
    generate('configured_skills' => [valid_skill])
    expect(original.reload.ai_level).to eq(4)
    expect(original.assessor_override.id).to eq(revision.id)
    expect(original.assessor_override.override_level).to eq(5)
    vacancy = Vacancy.find_by!(role_title: 'Backend Engineer')
    vacancy.vacancy_skills.create!(skill_id: original.skill_id, skill_label: original.skill_label, expected_level: 3)
    comparison = FitGap::Engine.new(portfolio: portfolio.reload, vacancy: vacancy).call.skill_comparisons.first
    expect(comparison).to include('ai_level' => 3, 'candidate_level' => 5, 'rating_source' => 'assessor')
  end

  it 'keeps a human-reviewed skill even when the provider omits it' do
    original = add_rating(portfolio)
    original.create_assessor_override!(ai_level: 3, override_level: 5, overridden_by: 1)
    generate('configured_skills' => [])
    expect(original.reload.assessor_override.override_level).to eq(5)
  end

  it 'records a safe error when the provider times out' do
    portfolio.update!(generation_status: 'failed')
    client = instance_double(Gemini::HttpClient)
    allow(client).to receive(:generate_content).and_raise(Timeout::Error, 'private transcript')
    expect { described_class.new(session: session, gemini_client: client).call }.to raise_error(Timeout::Error)
    expect(portfolio.reload.generation_error).not_to include('private transcript')
  end
end
