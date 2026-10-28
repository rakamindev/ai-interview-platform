# frozen_string_literal: true

# Append-only history of assessor decisions on a portfolio skill: set (change
# the level), revert (back to the AI level) and confirm (agree with the AI
# level). It is the record of human review (UU PDP Pasal 10 and 31), so saved
# events are read-only; they are only removed together with their skill.
class AssessorOverrideEvent < ApplicationRecord
  ACTIONS   = %w[set revert confirm].freeze
  MAX_NOTES = 2_000

  belongs_to :portfolio_skill

  validates :action, inclusion: { in: ACTIONS }
  validates :actor_id, presence: true
  validates :notes, presence: true, unless: -> { action == 'confirm' }
  validates :notes, length: { maximum: MAX_NOTES }, allow_nil: true
  validates :from_level, :to_level, :ai_level_at_time,
            numericality: { only_integer: true, in: 1..5 }, allow_nil: true

  def readonly?
    persisted?
  end
end
