# frozen_string_literal: true

class AssessorOverride < ApplicationRecord
  belongs_to :portfolio_skill

  validates :ai_level,       numericality: { only_integer: true, in: 1..5 }
  validates :override_level, numericality: { only_integer: true, in: 1..5 }
  validates :overridden_by,  presence: true
  validates :assessor_notes, length: { maximum: 2000 }, allow_nil: true
end
