# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  # skill_comparisons must be a well-formed structure, but an *empty* one is
  # legitimate: a vacancy is only required to have a role_title, so a vacancy
  # with no skills yields nothing to compare. `presence: true` rejected `[]`
  # because Rails treats an empty array as blank, which made N13 raise
  # RecordInvalid for such vacancies — the job then exhausted its retries and
  # the UI polled a report that would never arrive.
  validate :skill_comparisons_must_be_a_list

  private

  def skill_comparisons_must_be_a_list
    errors.add(:skill_comparisons, 'must be a list') unless skill_comparisons.is_a?(Array)
  end
end
