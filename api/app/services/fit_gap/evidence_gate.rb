# frozen_string_literal: true

module FitGap
  # Decides whether a fit/gap comparison has enough evidence to support a hiring recommendation.
  # Deterministic on purpose: the same model that writes the recommendation must not judge
  # whether there is enough evidence to write one.
  #
  # Any of these withholds the recommendation:
  # - no_vacancy_skills:    the vacancy defines nothing to compare against
  # - skills_not_assessed:  a required skill has no rating (AI or assessor)
  # - low_confidence:       a rating is low-confidence and no assessor confirmed it
  # - interview_incomplete: the candidate ended the interview, or it ended with an error
  module EvidenceGate
    INCOMPLETE_END_REASONS = %w[manual_candidate error].freeze

    module_function

    # comparisons: FitGap::Engine skill comparison hashes
    # Returns { status: 'sufficient' | 'insufficient_evidence', gaps: [{ reason:, skills: [...] }] }
    def evaluate(comparisons:, session:)
      gaps = []
      gaps << { reason: 'no_vacancy_skills', skills: [] } if comparisons.empty?
      add_gap(gaps, 'skills_not_assessed', comparisons.select { |c| c[:result] == 'not_assessed' })
      add_gap(gaps, 'low_confidence', comparisons.select { |c| c[:confidence] == 'low' && !c[:is_override] })
      if INCOMPLETE_END_REASONS.include?(session.end_reason)
        gaps << { reason: 'interview_incomplete', skills: [], end_reason: session.end_reason }
      end

      { status: gaps.empty? ? 'sufficient' : 'insufficient_evidence', gaps: gaps }
    end

    def add_gap(gaps, reason, comparisons)
      gaps << { reason: reason, skills: comparisons.map { |c| c[:skill_label] } } if comparisons.any?
    end
  end
end
