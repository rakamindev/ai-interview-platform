# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  include TenantScoped

  CONFIDENCE_LEVELS = %w[high medium low].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  validates :skill_label, presence: true
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }
  validates :competency_summary, presence: true

  after_commit :invalidate_fit_gap_reports

  def evidence_items
    Array(evidence).filter_map do |item|
      if item.is_a?(String)
        {
          'quote' => item,
          'turn_id' => nil,
          'turn_number' => nil,
          'verification_status' => 'legacy'
        }
      elsif verified_citation?(item)
        item.slice('turn_id', 'turn_number', 'quote', 'verification_status')
      end
    end
  end

  def evidence_status
    statuses = evidence_items.map { |item| item['verification_status'] }
    return 'verified' if statuses.include?('verified')
    return 'legacy' if statuses.include?('legacy')

    'insufficient'
  end

  private

  def verified_citation?(item)
    item.is_a?(Hash) &&
      item['verification_status'] == 'verified' &&
      item['turn_id'].present? &&
      item['turn_number'].present? &&
      item['quote'].present?
  end

  def invalidate_fit_gap_reports
    tenant_id = Portfolio.unscoped.where(id: portfolio_id).pick(:tenant_id)
    return unless tenant_id

    FitGap::RegenerationCoordinator.invalidate_portfolio!(portfolio_id:, tenant_id:)
  end
end
