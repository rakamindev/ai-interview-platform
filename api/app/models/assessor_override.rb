# frozen_string_literal: true

class AssessorOverride < ApplicationRecord
  MAX_NOTES_LENGTH = 2_000

  belongs_to :portfolio_skill

  validates :ai_level,       numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validates :override_level, numericality: { only_integer: true, in: 1..5 }
  validates :overridden_by,  presence: true
  validates :assessor_notes, length: { maximum: MAX_NOTES_LENGTH }
  validate :notes_required_for_unrated_skill

  private

  def notes_required_for_unrated_skill
    return if portfolio_skill.nil? || portfolio_skill.assessed? || assessor_notes.present?

    errors.add(:base, 'Add a note: this skill was not assessed in the interview, so say what your rating is based on.')
  end
end
