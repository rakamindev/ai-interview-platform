# frozen_string_literal: true

require 'spec_helper'
# When the whole suite runs, Rails is already booted and Zeitwerk owns these
# constants. Only load them by hand for the database-free subset.
unless defined?(Rails)
  require_relative '../../../app/services/portfolios/coverage_lookup'
  require_relative '../../../app/services/portfolios/not_assessed_skills'
end

RSpec.describe Portfolios::NotAssessedSkills do
  let(:configured) { Struct.new(:skill_id, :skill_label, :expected_level) }
  let(:scored)     { Struct.new(:skill_id, :skill_label) }
  let(:coverage)   { Struct.new(:skill_id, :skill_label, :state) }

  let(:assessment_skills) do
    [
      configured.new('sk-eng-001', 'React / Frontend Development', 3),
      configured.new('sk-eng-002', 'System Design', 4),
      configured.new('sk-eng-003', 'Testing Discipline', 3)
    ]
  end

  let(:coverage_maps) do
    [
      coverage.new('sk-eng-001', 'React / Frontend Development', 'covered'),
      coverage.new('sk-eng-002', 'System Design', 'not_yet'),
      coverage.new('sk-eng-003', 'Testing Discipline', 'partial')
    ]
  end

  def call(portfolio_skills)
    described_class.call(
      assessment_skills: assessment_skills,
      portfolio_skills:  portfolio_skills,
      coverage_maps:     coverage_maps
    )
  end

  it 'leaves out skills that were scored' do
    result = call([scored.new('sk-eng-001', 'React / Frontend Development')])

    expect(result.map(&:skill_id)).to contain_exactly('sk-eng-002', 'sk-eng-003')
  end

  it 'says a skill was never discussed when its coverage state is not_yet' do
    entry = call([]).find { |e| e.skill_id == 'sk-eng-002' }

    expect(entry.reason).to eq(:not_discussed)
    expect(entry.coverage_state).to eq('not_yet')
  end

  # The other half of the story: the interview DID cover it, but the model gave
  # back nothing usable, so there is evidence and no defensible level.
  it 'says a skill has no rating when it was discussed but never scored' do
    entry = call([]).find { |e| e.skill_id == 'sk-eng-003' }

    expect(entry.reason).to eq(:no_rating)
    expect(entry.coverage_state).to eq('partial')
  end

  it 'carries the expected level through so the assessor sees what is missing' do
    entry = call([]).find { |e| e.skill_id == 'sk-eng-002' }

    expect(entry.expected_level).to eq(4)
  end

  it 'matches on the label when the scored skill has no skill_id' do
    result = call([scored.new(nil, 'react / frontend development')])

    expect(result.map(&:skill_id)).not_to include('sk-eng-001')
  end

  it 'returns everything when nothing was scored at all' do
    expect(call([]).size).to eq(3)
  end

  it 'returns nothing when every configured skill was scored' do
    all = assessment_skills.map { |s| scored.new(s.skill_id, s.skill_label) }

    expect(call(all)).to be_empty
  end
end
