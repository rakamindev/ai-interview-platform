# frozen_string_literal: true

require_relative '../../spec_helper'
require_relative '../../../app/services/fit_gap/comparison'

RSpec.describe FitGap::Comparison do
  let(:requirement) { { id: 1, skill_id: 'react', skill_label: 'React', expected_level: 3 } }
  let(:skill) { { id: 8, skill_id: 'react', skill_label: 'React', ai_level: 3, confidence: 'low' } }

  def compare(requirements, skills)
    described_class.new(requirements: requirements, skills: skills).call
  end

  it 'exposes required levels and low-confidence provenance' do
    expect(compare([requirement], [skill]).first).to include(expected_level: 3, candidate_level: 3, delta: 0, result: 'match', rating_source: 'ai', confidence: 'low', is_override: false)
  end

  it 'distinguishes below and above requirements' do
    expect(compare([requirement], [skill.merge(ai_level: 2)]).first).to include(result: 'gap', delta: -1)
    expect(compare([requirement], [skill.merge(ai_level: 5)]).first).to include(result: 'exceed', delta: 2)
  end

  it 'does not turn a missing assessment into a gap' do
    expect(compare([requirement], []).first).to include(result: 'not_assessed', candidate_level: nil, delta: nil, reason: 'missing_skill')
  end

  [nil, 0, 6, -1, 2.5, true, 'L3', '3.0', '3oops', '', {}, []].each do |invalid|
    it "does not manufacture a level from #{invalid.inspect}" do
      expect(compare([requirement], [skill.merge(ai_level: invalid)]).first).to include(result: 'not_assessed', candidate_level: nil, delta: nil, reason: 'missing_rating')
    end
  end

  it 'accepts an explicit integer string' do
    expect(compare([requirement], [skill.merge(ai_level: '4')]).first).to include(candidate_level: 4, result: 'exceed')
  end

  it 'uses the assessor rating with explicit provenance' do
    expect(compare([requirement], [skill.merge(override_level_present: true, override_level: 4)]).first).to include(candidate_level: 4, rating_source: 'assessor', is_override: true, confidence: 'low')
  end

  it 'does not fall back to AI when an override is invalid' do
    expect(compare([requirement], [skill.merge(override_level_present: true, override_level: nil)]).first).to include(result: 'not_assessed', reason: 'missing_rating')
  end

  it 'matches an ID before a renamed label' do
    expect(compare([requirement], [skill.merge(skill_label: 'New label')]).first[:result]).to eq('match')
  end

  it 'does not merge different canonical IDs with identical labels' do
    expect(compare([requirement], [skill.merge(skill_id: 'other')]).first[:result]).to eq('not_assessed')
  end

  it 'normalizes a custom label when one ID is unavailable' do
    expect(compare([requirement], [skill.merge(skill_id: nil, skill_label: '  REACT  ')]).first[:result]).to eq('match')
  end

  it 'does not choose between ambiguous matches' do
    expect(compare([requirement], [skill, skill.merge(id: 9)]).first).to include(reason: 'ambiguous_skill', result: 'not_assessed')
  end

  it 'preserves requirements with repeated labels' do
    rows = compare([requirement, requirement.merge(id: 2, skill_id: 'different')], [skill])
    expect(rows.map { |row| row[:vacancy_skill_id] }).to eq([1, 2])
    expect(rows.map { |row| row[:result] }).to eq(%w[match not_assessed])
  end

  it 'marks an invalid requirement as incomplete configuration' do
    expect(compare([requirement.merge(expected_level: nil)], [skill]).first).to include(expected_level: nil, candidate_level: nil, result: 'not_assessed', reason: 'invalid_requirement')
  end

  it 'accepts an empty requirement list' do
    expect(compare([], [skill])).to eq([])
  end
end
