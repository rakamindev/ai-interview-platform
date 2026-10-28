# frozen_string_literal: true

require 'rails_helper'

# AC-24 / AC-25: regenerating a portfolio updates skills in place by a stable
# key, so assessor overrides and their history survive.
RSpec.describe Portfolios::Generator do
  let(:interview_session) { create(:session) }

  def response_with(*skills)
    { 'configured_skills' => skills.map { |label, level|
      { 'skill_label' => label, 'level' => level, 'evidence' => ["Kandidat Contoh: #{label}."],
        'competency_summary' => 'Contoh.' }
    }, 'discovered_skills' => [] }
  end

  def generate(response)
    described_class.new(session: interview_session, gemini_client: FakeGeminiClient.new(response)).call
  end

  def skill(label)
    interview_session.reload.portfolio.portfolio_skills.find_by!(skill_label: label)
  end

  before do
    %w[Ruby\ on\ Rails API\ Design].each { |label| create(:coverage_map, session: interview_session, skill_label: label) }
    generate(response_with(['Ruby on Rails', 2], ['API Design', 3]))
    rails = skill('Ruby on Rails')
    rails.create_assessor_override!(ai_level: 2, override_level: 4, assessor_notes: 'Contoh catatan.',
                                    overridden_by: 7, overridden_at: Time.current)
    AssessorOverrideEvent.create!(portfolio_skill: rails, action: 'set', from_level: 2, to_level: 4,
                                  ai_level_at_time: 2, notes: 'Contoh catatan.', actor_id: 7)
    interview_session.portfolio.update!(generation_status: 'failed')
  end

  it 'keeps the skill row, the override and its history, and updates the AI level (AC-24)' do
    original_id = skill('Ruby on Rails').id

    generate(response_with(['Ruby on Rails', 3], ['API Design', 3]))

    rails = skill('Ruby on Rails')
    expect(rails.id).to eq(original_id)
    expect(rails).to have_attributes(ai_level: 3, rating_status: 'assessed')
    expect(rails.assessor_override).to have_attributes(override_level: 4)
    expect(AssessorOverrideEvent.where(portfolio_skill: rails).count).to eq(1)
  end

  it 'matches the stored skill even when the model changes case or spacing of the label' do
    original_id = skill('Ruby on Rails').id

    generate(response_with(['  ruby   ON rails ', 3], ['API Design', 3]))

    expect(interview_session.portfolio.portfolio_skills.where(id: original_id)).to exist
    expect(interview_session.portfolio.portfolio_skills.count).to eq(2)
  end

  it 'keeps an overridden skill the model no longer returns, as not assessed (AC-25)' do
    generate(response_with(['API Design', 3]))

    rails = skill('Ruby on Rails')
    expect(rails).to have_attributes(rating_status: 'not_assessed', not_assessed_reason: 'not_covered', ai_level: nil)
    expect(rails.assessor_override).to have_attributes(override_level: 4)
  end

  it 'removes a skill without an override that the model no longer returns' do
    generate(response_with(['Ruby on Rails', 3]))

    expect(interview_session.portfolio.portfolio_skills.pluck(:skill_label)).to eq(['Ruby on Rails'])
  end

  it 'ignores a duplicate skill in one model response instead of failing' do
    generate(response_with(['Ruby on Rails', 3], ['ruby on rails', 1], ['API Design', 3]))

    expect(interview_session.portfolio.reload.generation_status).to eq('complete')
    expect(skill('Ruby on Rails').ai_level).to eq(3)
  end
end
