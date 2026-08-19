# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze

  belongs_to :portfolio
  belongs_to :vacancy
  belongs_to :vacancy_version, optional: true

  validates :skill_comparisons, presence: true
end
