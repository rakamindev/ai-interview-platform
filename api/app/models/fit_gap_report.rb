# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  include TenantScoped

  FIT_RESULTS = %w[match gap exceed not_assessed insufficient_evidence].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  # NOT presence: true — a vacancy with zero required skills legitimately
  # produces an empty (but non-nil) skill_comparisons array (AC-1.11), and
  # `[].blank?` is true so `presence` would reject that valid state. The
  # column is `null: false` at the DB level, which is the actual invariant.

  def pending?    = status == "pending"
  def generating? = status == "generating"
  def complete?   = status == "complete"
  def failed?     = status == "failed"

  def ai_narrative? = narrative_source == "ai"
  def fallback_narrative? = narrative_source == "fallback"
end
