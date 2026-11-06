# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze
  REGENERATION_COOLDOWN = 2.minutes
  # Generic on purpose: exception messages may contain candidate data.
  FAILURE_MESSAGE = 'The report could not be updated. Showing the previous version.'

  belongs_to :portfolio
  belongs_to :vacancy

  validates :skill_comparisons, presence: true

  # Marks the report stale and queues a regeneration.
  # - force: true is used after an override (always queue; the worker is idempotent).
  # - without force (when a report is read) a cooldown avoids flooding Gemini.
  # The conditional update_all is atomic, so two concurrent requests cannot
  # both queue a job within the cooldown window.
  def request_regeneration!(force: false)
    scope = self.class.where(id:)
    unless force
      scope = scope.where('regeneration_requested_at IS NULL OR regeneration_requested_at < ?',
                          REGENERATION_COOLDOWN.ago)
    end
    return false if scope.update_all(stale: true, regeneration_requested_at: Time.current).zero?

    FitGapGeneratorWorker.perform_async(portfolio_id, vacancy_id)
    true
  end

  # The report already reflects the latest override, so a regeneration job can be skipped.
  def fresh_for?(latest_override_at)
    !stale && self.class.same_instant?(based_on_override_at, latest_override_at)
  end

  def self.same_instant?(left, right)
    return left.nil? && right.nil? if left.nil? || right.nil?

    (left - right).abs < 0.001
  end
end
