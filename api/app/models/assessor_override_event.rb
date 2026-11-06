# frozen_string_literal: true

# One entry in the history of level changes made by assessors. Append-only.
class AssessorOverrideEvent < ApplicationRecord
  REASON_LENGTH = 10..1000

  belongs_to :portfolio_skill

  validates :previous_level, :new_level, :ai_level, numericality: { only_integer: true, in: 1..5 }
  validates :actor_id, presence: true
  # Backfilled (legacy) events may have no reason: they come from old data.
  validates :reason, length: { in: REASON_LENGTH }, unless: :legacy?

  scope :newest_first, -> { order(created_at: :desc, id: :desc) }

  # Saved events cannot be changed or deleted through the app.
  # They are only removed by the database cascade together with their skill.
  def readonly?
    persisted?
  end
end
