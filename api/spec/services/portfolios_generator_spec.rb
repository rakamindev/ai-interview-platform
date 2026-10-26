# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:org) { create(:organization) }
  let(:session) { create(:session, assessment: create(:assessment, organization: org)) }
  let!(:portfolio) { create(:portfolio, session:) }
  let!(:communication) do
    create(:portfolio_skill, portfolio:, skill_id: 'communication', skill_label: 'Communication', ai_level: 2)
  end
  let!(:override) do
    create(:assessor_override, portfolio_skill: communication, ai_level: 2, override_level: 3,
                               assessor_notes: 'Verified in follow-up')
  end

  def model_output(level: 3, confidence: 'medium', extra: [])
    {
      'configured_skills' => [
        { 'skill_id' => 'communication', 'skill_label' => 'Communication', 'level' => level,
          'confidence' => confidence, 'evidence' => ['q'], 'competency_summary' => 'Summary.' }
      ] + extra,
      'discovered_skills' => []
    }
  end

  def regenerate(response)
    described_class.new(session:, gemini_client: fake_model(response)).call
  end

  it 'keeps assessor overrides when the portfolio is regenerated (F8)' do
    regenerate(model_output(level: 2))

    skill = portfolio.reload.portfolio_skills.find_by!(skill_label: 'Communication')
    expect(skill.assessor_override).to have_attributes(override_level: 3, assessor_notes: 'Verified in follow-up')
  end

  it 're-attaches by normalised label when the model drops the skill_id' do
    output = model_output
    output['configured_skills'].first.merge!('skill_id' => nil, 'skill_label' => ' communication. ')
    regenerate(output)

    expect(portfolio.reload.assessor_overrides.map(&:override_level)).to eq([3])
  end

  it 'normalises model confidence casing instead of failing the enum insert' do
    regenerate(model_output(confidence: 'HIGH'))

    expect(portfolio.reload.portfolio_skills.first.ai_confidence).to eq('high')
  end

  it 'leaves the previous skills and overrides intact when the write fails midway (no partial portfolio)' do
    bad = { 'skill_id' => 'x', 'skill_label' => 'Broken', 'level' => 3, 'confidence' => 'high',
            'evidence' => [], 'competency_summary' => nil } # fails presence validation

    expect { regenerate(model_output(extra: [bad])) }.to raise_error(ActiveRecord::RecordInvalid)

    expect(portfolio.reload.portfolio_skills.pluck(:skill_label)).to eq(['Communication'])
    expect(AssessorOverride.exists?(override.id)).to be(true)
    expect(portfolio.generation_status).to eq('failed')
  end
end
