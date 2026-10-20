# frozen_string_literal: true

class AssessorOverride < ApplicationRecord
  belongs_to :portfolio_skill

  # ai_level is the AI's level when the override was made; nil when the AI didn't rate the skill.
  validates :ai_level,       numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validates :override_level, numericality: { only_integer: true, in: 1..5 }
  validates :overridden_by,  presence: true

  # A human rating with no AI evidence underneath has to say where it came from (AC-20).
  validates :assessor_notes, presence: { message: 'are required when the AI did not rate this skill' },
                             if: -> { ai_level.nil? }
end
