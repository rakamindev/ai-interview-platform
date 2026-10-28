# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AssessorOverrideEvent do
  let(:skill) { create(:portfolio_skill, ai_level: 2) }

  def event(attributes = {})
    described_class.new({ portfolio_skill: skill, action: 'set', from_level: 2, to_level: 3,
                          ai_level_at_time: 2, notes: 'Contoh catatan.', actor_id: 7 }.merge(attributes))
  end

  it 'requires a note for set and revert, but not for confirm' do
    expect(event(notes: ' ')).not_to be_valid
    expect(event(action: 'revert', notes: nil)).not_to be_valid
    expect(event(action: 'confirm', from_level: 2, to_level: 2, notes: nil)).to be_valid
  end

  it 'only accepts known actions' do
    expect(event(action: 'delete')).not_to be_valid
  end

  it 'is append-only: a saved event cannot be changed' do
    saved = event.tap(&:save!)

    expect { saved.update!(notes: 'Diubah.') }.to raise_error(ActiveRecord::ReadOnlyRecord)
  end
end
