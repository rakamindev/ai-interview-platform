# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  include TenantScopedThrough

  FIT_RESULTS         = %w[match gap exceed not_assessed].freeze
  NARRATIVE_STATUSES  = %w[complete fallback].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  tenant_scoped_through(portfolio: :session)

  validates :narrative_status, inclusion: { in: NARRATIVE_STATUSES }
  validate  :skill_comparisons_must_be_an_array

  # True when the narrative is the mechanical stub written after the model
  # call failed, rather than a generated one. Surfaced to the client so a
  # degraded report is never mistaken for a complete one.
  def fallback_narrative? = narrative_status == 'fallback'

  private

  # `validates :skill_comparisons, presence: true` rejected `[]`, because an
  # empty array is blank in Rails. A vacancy with no skills recorded is a
  # legitimate — if unhelpful — report, and raising RecordInvalid inside the
  # worker turned it into a job that retried and never terminated. What we
  # actually need to reject is a null or non-array payload.
  def skill_comparisons_must_be_an_array
    return if skill_comparisons.is_a?(Array)

    errors.add(:skill_comparisons, 'must be an array of comparisons')
  end
end
