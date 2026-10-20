# frozen_string_literal: true

class AssessorOverride < ApplicationRecord
  belongs_to :portfolio_skill

  # NULL when the AI did not assess the skill and the assessor rated it from scratch.
  validates :ai_level,       numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validates :override_level, numericality: { only_integer: true, in: 1..5 }
  validates :overridden_by,  presence: true
end
