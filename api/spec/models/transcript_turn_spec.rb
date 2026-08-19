# frozen_string_literal: true

require 'rails_helper'

RSpec.describe TranscriptTurn, type: :model do
  describe 'validations' do
    it { should validate_presence_of(:turn_number) }
    it { should validate_numericality_of(:turn_number).only_integer.is_greater_than(0) }
    it { should validate_inclusion_of(:speaker).in_array(TranscriptTurn::SPEAKERS) }
    it { should validate_presence_of(:text) }
  end

  describe 'associations' do
    it { should belong_to(:session) }
  end

  describe 'scopes' do
    it '.ordered returns turns ordered by turn_number' do
      session = create(:session, :active)
      t2 = create(:transcript_turn, session: session, turn_number: 2)
      t1 = create(:transcript_turn, session: session, turn_number: 1)

      expect(session.transcript_turns.ordered).to eq([t1, t2])
    end
  end

  describe 'factory' do
    it 'has a valid factory' do
      expect(build(:transcript_turn)).to be_valid
    end
  end
end
