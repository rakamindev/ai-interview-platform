# frozen_string_literal: true

class TranscriptRevision < ApplicationRecord
  belongs_to :transcript_turn

  validates :revised_text, presence: true
  validates :reason, presence: true
  validates :revised_by, presence: true
  validate :candidate_turn

  private

  def candidate_turn
    errors.add(:transcript_turn, 'must be candidate speech') unless transcript_turn&.speaker == 'candidate'
  end
end
