# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze
  GENERATION_STATUSES = %w[pending generating complete failed stale].freeze
  GENERATION_TIMEOUT = 2.minutes

  belongs_to :portfolio
  belongs_to :vacancy

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }
  validate do
    errors.add(:skill_comparisons, 'must be an array') unless skill_comparisons.is_a?(Array)
  end

  def timed_out?
    %w[pending generating].include?(generation_status) && (requested_at.nil? || requested_at < GENERATION_TIMEOUT.ago)
  end

  def review_status
    return 'failed' if timed_out?
    return generation_status unless generation_status == 'complete'
    source_digest == FitGap::Snapshot.new(portfolio: portfolio, vacancy: vacancy).digest ? 'complete' : 'stale'
  end

  def current?
    review_status == 'complete'
  end

  def summary
    counts = skill_comparisons.group_by { |comparison| comparison['result'] }.transform_values(&:length)
    { total_requirements: skill_comparisons.length, assessed_count: skill_comparisons.count { |c| c['candidate_level'].present? },
      match_count: counts.fetch('match', 0), exceed_count: counts.fetch('exceed', 0), gap_count: counts.fetch('gap', 0),
      not_assessed_count: counts.fetch('not_assessed', 0), reviewed_count: skill_comparisons.count { |c| c['rating_source'] == 'assessor' },
      low_confidence_count: skill_comparisons.count { |c| c['confidence'] == 'low' && c['rating_source'] == 'ai' && c['candidate_level'].present? } }
  end
end
