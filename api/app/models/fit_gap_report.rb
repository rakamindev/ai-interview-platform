# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS        = %w[match gap exceed not_assessed].freeze
  NARRATIVE_STATUSES = %w[pending ready failed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  # An empty array is valid: a vacancy with no required skills yields an (empty) report.
  validate :skill_comparisons_present
  validates :narrative_status, inclusion: { in: NARRATIVE_STATUSES }

  def skill_comparisons_present
    errors.add(:skill_comparisons, "can't be nil") if skill_comparisons.nil?
  end
  private :skill_comparisons_present

  def narrative_pending? = narrative_status == 'pending'
  def narrative_failed?  = narrative_status == 'failed'

  # Reports written before the comparator existed used `expected_level` and had no
  # `is_override` / `confidence` / summary. Present every row in the current shape.
  def comparisons_for_api
    skill_comparisons.map do |c|
      c = c.with_indifferent_access
      c[:required_level] ||= c[:expected_level]
      c[:is_override] = false unless c.key?(:is_override)
      c[:low_evidence] = false unless c.key?(:low_evidence)
      c
    end
  end

  def summary_for_api
    return summary.with_indifferent_access if summary.present?

    cmp = comparisons_for_api
    total = cmp.size
    not_assessed = cmp.count { |c| c[:result] == 'not_assessed' }
    {
      total: total, assessed: total - not_assessed,
      match: cmp.count { |c| c[:result] == 'match' }, exceed: cmp.count { |c| c[:result] == 'exceed' },
      gap: cmp.count { |c| c[:result] == 'gap' }, not_assessed: not_assessed,
      low_evidence: 0, overridden: 0,
      coverage_pct: total.zero? ? nil : (((total - not_assessed) * 100.0) / total).round
    }.with_indifferent_access
  end
end
