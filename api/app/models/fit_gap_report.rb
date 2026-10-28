# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  validates :skill_comparisons, presence: true

  def comparisons
    raw = if skill_comparisons.is_a?(Hash)
      skill_comparisons['comparisons'] || skill_comparisons[:comparisons] || []
    else
      skill_comparisons || []
    end
    raw.map { |c| c.is_a?(Hash) ? c.with_indifferent_access : c }
  end

  def summary
    if skill_comparisons.is_a?(Hash) && (skill_comparisons['summary'] || skill_comparisons[:summary])
      return (skill_comparisons['summary'] || skill_comparisons[:summary]).symbolize_keys
    end

    comps = comparisons
    matches = comps.select { |c| (c['result'] || c[:result]) == 'match' }
    gaps = comps.select { |c| (c['result'] || c[:result]) == 'gap' }
    exceeds = comps.select { |c| (c['result'] || c[:result]) == 'exceed' }
    not_assessed = comps.select { |c| (c['result'] || c[:result]) == 'not_assessed' }
    denom = [matches.count + exceeds.count + gaps.count, 1].max

    {
      match_count:        matches.count,
      gap_count:          gaps.count,
      exceed_count:       exceeds.count,
      not_assessed_count: not_assessed.count,
      fit_percentage:     ((matches.count + exceeds.count).to_f / denom * 100).round(1)
    }
  end
end
