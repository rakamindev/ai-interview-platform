# frozen_string_literal: true

# What a human decided, and what they were looking at when they decided it.
#
# Append-only. An audit trail that can be quietly edited is not one, so an
# update raises rather than saving. Changing your mind is a new fact about a
# later moment, not an edit to an earlier one; if this product needs that, it
# needs a second row and a reason, not a mutable first row.
class HiringDecision < ApplicationRecord
  DECISIONS = %w[advance hold reject].freeze

  # Long enough to have said something. Short enough not to be theatre.
  # A decision nobody can explain is the thing this table exists to prevent,
  # and "good fit" is not an explanation a rejected candidate could be shown.
  MIN_RATIONALE = 20

  belongs_to :portfolio

  validates :decision, inclusion: { in: DECISIONS }
  validates :portfolio_id, uniqueness: true
  validates :decided_by, :decided_at, presence: true
  validates :rationale, presence: true, length: { minimum: MIN_RATIONALE }

  before_update { raise ActiveRecord::ReadOnlyRecord, 'A hiring decision cannot be edited' }

  # The ratings as they stood when someone acted on them, including any assessor
  # override, frozen at that moment.
  #
  # Regenerating a portfolio destroys and rewrites its skills, and the assessor
  # overrides attached to them. A decision that only pointed at the portfolio
  # would change meaning afterwards without anyone touching it, which is exactly
  # the failure this record is meant to survive.
  def self.snapshot_of(portfolio)
    portfolio.portfolio_skills.includes(:assessor_override).each_with_object({}) do |skill, acc|
      override = skill.assessor_override
      acc[skill.skill_label] = {
        'ai_level'        => skill.ai_level,
        'effective_level' => override ? override.override_level : skill.ai_level,
        'confidence'      => skill.ai_confidence,
        'overridden'      => override.present?,
        'is_discovered'   => skill.is_discovered,
        # An unrated skill is part of the picture the decision was made on, and
        # it is the part most likely to be forgotten afterwards.
        'assessed'        => skill.ai_level.present?
      }
    end
  end
end
