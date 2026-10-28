# frozen_string_literal: true

module Portfolios
  # Why a portfolio still needs a human (UU PDP Pasal 10). The single rule for
  # the review queue and the candidate list; it reads the same presenters as
  # the portfolio and fit/gap pages, so counts cannot drift from those pages.
  #
  # Configured skills only, the same as the portfolio summary: discovered
  # skills are extra findings, not requirements.
  class ReviewReasons
    CODES = %w[generation_failed empty_portfolio legacy_ratings unreviewed_low_confidence unreviewed_not_assessed
               narrative_failed narrative_outdated].freeze
    GROUPS = {
      'skills' => %w[unreviewed_low_confidence unreviewed_not_assessed],
      'narratives' => %w[narrative_failed narrative_outdated],
      'legacy' => %w[legacy_ratings],
      'portfolio' => %w[generation_failed empty_portfolio]
    }.freeze
    NARRATIVE_CODES = GROUPS['narratives']
    # Everything the rule reads, for callers that check many portfolios.
    PRELOAD = [
      { session: :assessment },
      { portfolio_skills: %i[assessor_override override_events] },
      { fit_gap_reports: { vacancy: :vacancy_skills } }
    ].freeze

    def initialize(portfolio)
      @portfolio = portfolio
    end

    # [{ code:, count: }] for every reason with a count above zero.
    def reasons
      @reasons ||= counts.filter_map { |code, count| { code: code, count: count } if count.positive? }
    end

    def needs_review?
      reasons.any?
    end

    # When the portfolio became something to review: when it was generated,
    # or when the interview ended for a failed generation.
    def waiting_since
      @portfolio.generated_at || @portfolio.session.ended_at || @portfolio.session.created_at
    end

    # Where the assessor reviews it: the fit/gap report when only a narrative
    # needs attention, otherwise the portfolio.
    def target
      codes = reasons.pluck(:code)
      if codes.any? && (codes - NARRATIVE_CODES).empty?
        { page: 'fitgap', vacancy_id: narrative_vacancy_ids.first }
      else
        { page: 'portfolio', vacancy_id: nil }
      end
    end

    private

    def counts
      return { 'generation_failed' => 1 } if @portfolio.failed?
      return {} unless @portfolio.complete?

      {
        # A complete portfolio without any skill has nothing to compare; a
        # person has to decide what happened (scenario L).
        'empty_portfolio' => @portfolio.portfolio_skills.empty? ? 1 : 0,
        'legacy_ratings' => @portfolio.ratings_validated ? 0 : 1,
        'unreviewed_low_confidence' => skill_views.count { |v| v.level_source == 'ai' && v.confidence == 'low' },
        'unreviewed_not_assessed' => skill_views.count { |v| v.level_source.nil? },
        'narrative_failed' => narrative_statuses.count { |_, status| status == 'failed' },
        'narrative_outdated' => narrative_statuses.count { |_, status| status == 'outdated' }
      }
    end

    def skill_views
      @skill_views ||= @portfolio.portfolio_skills.reject(&:is_discovered).map { |s| SkillPresenter.new(s) }
    end

    # [[vacancy_id, status]] for every fit/gap report of the portfolio.
    def narrative_statuses
      @narrative_statuses ||= @portfolio.fit_gap_reports.sort_by(&:id).filter_map do |report|
        next unless report.vacancy

        status = FitGap::ReportPresenter.new(portfolio: @portfolio, vacancy: report.vacancy, report: report)
                                        .narrative[:status]
        [report.vacancy_id, status]
      end
    end

    def narrative_vacancy_ids
      narrative_statuses.select { |_, status| %w[failed outdated].include?(status) }.map(&:first)
    end
  end
end
