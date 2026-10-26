# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS       = %w[match gap exceed not_assessed].freeze
  STATUSES          = %w[generating ready failed].freeze
  NARRATIVE_SOURCES = %w[ai fallback].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  validates :status, inclusion: { in: STATUSES }
  validates :narrative_source, inclusion: { in: NARRATIVE_SOURCES }, allow_nil: true
  # skill_comparisons may be [] while generating; the column is NOT NULL with default [].

  STATUSES.each { |s| define_method("#{s}?") { status == s } }

  # Single entry point for (re)generation, so polling or double clicks never queue duplicate jobs.
  # Without force: a generating or ready report is left alone. force: an override or explicit
  # regenerate always re-queues, keeping the previous content visible until the job finishes.
  # Returns the report.
  def self.request_generation!(portfolio:, vacancy:, force: false)
    created = false
    report = begin
      find_or_create_by!(portfolio_id: portfolio.id, vacancy_id: vacancy.id) do |r|
        r.status = 'generating'
        created = true
      end
    rescue ActiveRecord::RecordNotUnique
      created = false
      retry # a concurrent first request won the insert; use its row
    end

    # with_lock reloads the row, so a concurrent request sees the status this one wrote.
    enqueue = created || report.with_lock do
      next false if !force && (report.ready? || report.generating?)

      report.update!(status: 'generating', error_message: nil)
      true
    end
    # Enqueue after the lock's transaction commits, so the job always sees status 'generating'.
    FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id) if enqueue
    report
  end

  # Counts derived from the stored comparisons, so the screen, PDF and JSON export agree.
  # "Not assessed" means no evidence: it lowers coverage but is never a match or a gap.
  def summary
    rows     = Array(skill_comparisons)
    total    = rows.size
    counts   = FIT_RESULTS.index_with { |r| rows.count { |c| c['result'] == r } }
    assessed = total - counts['not_assessed']

    {
      'total'          => total,
      'assessed'       => assessed,
      'not_assessed'   => counts['not_assessed'],
      'coverage_pct'   => total.zero? ? 0 : (assessed * 100.0 / total).round,
      'match'          => counts['match'],
      'gap'            => counts['gap'],
      'exceed'         => counts['exceed'],
      'low_confidence' => rows.count { |c| c['low_confidence'] }
    }
  end
end
