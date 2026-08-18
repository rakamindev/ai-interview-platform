# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  include TenantScoped

  FIT_RESULTS = %w[match gap exceed not_assessed insufficient_evidence].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  validates :skill_comparisons, presence: true

  def pending?    = status == "pending"
  def generating? = status == "generating"
  def complete?   = status == "complete"
  def failed?     = status == "failed"
end
