# frozen_string_literal: true

class AssessorOverride < ApplicationRecord
  belongs_to :portfolio_skill

  validates :ai_level,       numericality: { only_integer: true, in: 1..5 }
  validates :override_level, numericality: { only_integer: true, in: 1..5 }
  validates :overridden_by,  presence: true
  validates :assessor_notes, presence: { message: "is mandatory when overriding AI assessment level" },
                             length: { minimum: 10, message: "must be at least 10 characters explaining your rationale" },
                             if: :level_changed?

  def level_changed?
    override_level.present? && ai_level.present? && override_level != ai_level
  end
end
