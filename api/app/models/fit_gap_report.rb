# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze
  NARRATIVE_STATUSES = %w[pending generating complete failed].freeze

  attribute :narrative_status, :string, default: "pending"

  belongs_to :portfolio
  belongs_to :vacancy

  validates :skill_comparisons, presence: true
  validates :narrative_status, inclusion: { in: NARRATIVE_STATUSES }
  validates :narrative_generation, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  def narrative_pending? = narrative_status == "pending"
  def narrative_generating? = narrative_status == "generating"
  def narrative_complete? = narrative_status == "complete"
  def narrative_failed? = narrative_status == "failed"
end
