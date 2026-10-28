# frozen_string_literal: true

module FitGap
  # Summarises how many required skills were actually assessed, so a report
  # never reads as a clean "match" when most skills were never evaluated.
  module Coverage
    module_function

    def summarize(comparisons)
      list         = Array(comparisons)
      total        = list.size
      not_assessed = list.count { |c| result_of(c) == 'not_assessed' }

      {
        assessed:     total - not_assessed,
        total:        total,
        not_assessed: not_assessed,
        complete:     not_assessed.zero?
      }
    end

    def fallback_sentence(comparisons)
      list    = Array(comparisons)
      matches = list.count { |c| result_of(c) == 'match' }
      exceeds = list.count { |c| result_of(c) == 'exceed' }
      gaps    = list.count { |c| result_of(c) == 'gap' }

      text = "Candidate shows #{matches} skill matches, #{exceeds} exceeds, and #{gaps} gaps against role requirements."
      info = summarize(list)
      return text if info[:complete]

      "#{text} Only #{info[:assessed]} of #{info[:total]} required skills were assessed; " \
        "#{info[:not_assessed]} could not be evaluated, so this result is incomplete."
    end

    def result_of(comparison)
      (comparison[:result] || comparison['result']).to_s
    end
  end
end
