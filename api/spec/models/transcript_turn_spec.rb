# frozen_string_literal: true

require 'rails_helper'

RSpec.describe TranscriptTurn, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:session) }
  end

  describe 'validations' do
    it { is_expected.to validate_presence_of(:turn_number) }
    it { is_expected.to validate_numericality_of(:turn_number).only_integer.is_greater_than(0) }
    it { is_expected.to validate_inclusion_of(:speaker).in_array(%w[ai candidate]) }
    it { is_expected.to validate_presence_of(:text) }
  end

  describe 'scopes' do
    describe '.ordered' do
      it 'returns turns ordered by turn_number' do
        session = create(:session, :active)
        turn2 = create(:transcript_turn, session: session, turn_number: 2)
        turn1 = create(:transcript_turn, session: session, turn_number: 1)

        expect(session.transcript_turns.ordered).to eq([turn1, turn2])
      end
    end
  end

  describe 'constants' do
    it 'defines SPEAKERS' do
      expect(TranscriptTurn::SPEAKERS).to eq(%w[ai candidate])
    end
  end
end
