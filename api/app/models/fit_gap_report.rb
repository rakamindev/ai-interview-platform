# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  include SessionTenantScoped

  FIT_RESULTS = %w[match gap exceed not_assessed additional].freeze
  NARRATIVE_STATUSES = %w[complete failed skipped].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  scoped_to_tenant_through portfolio: :session

  validates :skill_comparisons, presence: true
  validates :narrative_status, inclusion: { in: NARRATIVE_STATUSES }
end
