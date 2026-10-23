# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = FitGap::Comparator::RESULTS

  belongs_to :portfolio
  belongs_to :vacancy

  # An empty array is a valid report: the vacancy has no requirements yet.
  validate { errors.add(:skill_comparisons, :blank) if skill_comparisons.nil? }

  # False for reports stored under older comparison rules (including every
  # report written before rules were versioned). Those must be recomputed,
  # never shown or exported as they are.
  def current_rules?
    comparator_version == FitGap::Comparator::VERSION
  end
end
