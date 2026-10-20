# frozen_string_literal: true

class AssessorOverride < ApplicationRecord
  belongs_to :portfolio_skill

  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validates :override_level, presence: true, numericality: { only_integer: true, in: 1..5 }
  validates :assessor_notes, presence: true, length: { maximum: 2000 }
  validates :overridden_by,  presence: true

  validate :notes_not_only_whitespace

  private

  def notes_not_only_whitespace
    if assessor_notes.present? && assessor_notes.strip.empty?
      errors.add(:assessor_notes, "can't be blank")
    end
  end
end
