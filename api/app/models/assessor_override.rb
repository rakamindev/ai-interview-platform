# frozen_string_literal: true

class AssessorOverride < ApplicationRecord
  belongs_to :portfolio_skill

  before_validation :normalize_assessor_notes

  validates :ai_level,       numericality: { only_integer: true, in: 1..5 }
  validates :override_level, numericality: { only_integer: true, in: 1..5 }
  validates :overridden_by,  presence: true
  validates :assessor_notes, presence: true, length: { minimum: 5, maximum: 2000 }

  private

  def normalize_assessor_notes
    self.assessor_notes = assessor_notes.to_s.strip
  end
end
