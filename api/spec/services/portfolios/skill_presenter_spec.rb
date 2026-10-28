# frozen_string_literal: true

require 'rails_helper'

# review is the human decision behind the effective level, shared by the API
# and the PDF so both show the same who, when and why.
RSpec.describe Portfolios::SkillPresenter do
  let(:skill)   { create(:portfolio_skill, ai_level: 2, ai_confidence: 'low') }
  let(:actions) { PortfolioSkills::OverrideActions.new(skill, actor_id: 7) }

  def review
    described_class.new(skill.reload).review
  end

  it 'has no review for an AI rating nobody reviewed' do
    expect(review).to be_nil
  end

  it 'describes an override with the AI level it replaced, the note, the assessor and the time' do
    travel_to(Time.utc(2026, 10, 24, 9, 30)) { actions.set(level: 3, notes: 'Contoh: tugas tertulis.') }

    expect(review).to eq(action: 'override', ai_level: 2, notes: 'Contoh: tugas tertulis.', actor_id: 7,
                         at: Time.utc(2026, 10, 24, 9, 30))
  end

  it 'describes a confirmation with its note' do
    travel_to(Time.utc(2026, 10, 24, 11, 0)) { actions.confirm(notes: 'Contoh: bukti cukup.') }

    expect(review).to eq(action: 'confirm', ai_level: 2, notes: 'Contoh: bukti cukup.', actor_id: 7,
                         at: Time.utc(2026, 10, 24, 11, 0))
  end

  it 'has no review after an override is reverted' do
    actions.set(level: 3, notes: 'Contoh.')
    actions.revert(notes: 'Contoh: salah input.')

    expect(review).to be_nil
  end

  it 'is part of the API payload' do
    actions.confirm(notes: 'Contoh: bukti cukup.')

    expect(described_class.new(skill.reload).as_json[:review]).to include(action: 'confirm', actor_id: 7)
  end
end
