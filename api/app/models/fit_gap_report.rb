# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  include TenantScopedBySession

  FIT_RESULTS = %w[match gap exceed not_assessed].freeze

  tenant_scoped_by portfolio: :session

  belongs_to :portfolio
  belongs_to :vacancy

  validates :skill_comparisons, presence: true
end
