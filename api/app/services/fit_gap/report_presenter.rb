# frozen_string_literal: true

require 'digest'

module FitGap
  # The fit/gap view model shared by the API, the JSON export and the PDF.
  # Comparisons are computed on read from the current portfolio, assessor
  # decisions and vacancy, so they can never be stale (D-3). Only levels that
  # are measured and either human reviewed or not low confidence count toward
  # fit; everything else is listed for follow-up (Q1).
  class ReportPresenter
    NARRATIVE_LABEL = 'AI generated, not a hiring decision'
    COUNTED_RESULTS = %w[match exceed gap].freeze

    def initialize(portfolio:, vacancy:, report: :lookup)
      @portfolio = portfolio
      @vacancy   = vacancy
      @report    = report == :lookup ? FitGapReport.find_by(portfolio: portfolio, vacancy: vacancy) : report
    end

    def comparisons
      @comparisons ||= vacancy_skills.map { |vacancy_skill| compare(vacancy_skill) }
    end

    # Fingerprint of everything the narrative is based on; a stored narrative
    # with another digest is outdated.
    def input_digest
      inputs = comparisons.map { |c| c.slice(:skill_label, :expected_level, :candidate_level, :level_source, :result) }
      Digest::SHA256.hexdigest(inputs.to_json)
    end

    def summary
      counts = comparisons.group_by { |c| c[:result] }.transform_values(&:size)
      {
        total: comparisons.size,
        evidenced: comparisons.count { |c| c[:counts_toward_fit] },
        match: counts.fetch('match', 0),
        exceed: counts.fetch('exceed', 0),
        gap: counts.fetch('gap', 0),
        not_assessed: counts.fetch('not_assessed', 0),
        low_confidence: counts.fetch('low_confidence', 0),
        overridden: comparisons.count { |c| c[:level_source] == 'assessor_override' },
        confirmed: comparisons.count { |c| c[:level_source] == 'assessor_confirmed' }
      }
    end

    def follow_up
      comparisons.reject { |c| c[:counts_toward_fit] }.map { |c| c[:skill_label] }
    end

    def narrative
      {
        status: narrative_status,
        source: @report&.narrative_source,
        label: NARRATIVE_LABEL,
        culture: ai_text(@report&.culture_narrative),
        overall: ai_text(@report&.overall_narrative),
        generated_at: @report&.completed_at,
        error_code: @report&.error_code
      }
    end

    def as_json(*)
      {
        portfolio_id: @portfolio.id,
        vacancy_id: @vacancy.id,
        role_title: @vacancy.role_title,
        ratings_validated: @portfolio.ratings_validated,
        summary: summary,
        comparisons: comparisons,
        follow_up: follow_up,
        narrative: narrative
      }
    end

    private

    def compare(vacancy_skill)
      skill = matching_skill(vacancy_skill)
      view  = skill && Portfolios::SkillPresenter.new(skill)
      level = view&.effective_level

      base = {
        skill_label: vacancy_skill.skill_label,
        skill_id: vacancy_skill.skill_id,
        expected_level: vacancy_skill.expected_level,
        ai_level: skill&.ai_level,
        candidate_level: level,
        level_source: view&.level_source,
        is_override: view&.override.present? || false,
        override_notes: view&.override&.assessor_notes,
        confidence: view&.confidence,
        not_assessed_reason: nil,
        tentative_direction: nil,
        # Link to the portfolio skill (evidence, summary) and its review trail,
        # so clients never match rows to skills by label themselves.
        portfolio_skill_id: skill&.id,
        probe_count: skill&.probe_count,
        review: view&.review
      }
      return base.merge(result: 'not_assessed', delta: nil, counts_toward_fit: false,
                        not_assessed_reason: skill&.not_assessed_reason || 'not_covered') if level.nil?

      delta = level - vacancy_skill.expected_level
      if view.confidence == 'low' && !view.human_reviewed?
        return base.merge(result: 'low_confidence', delta: delta, counts_toward_fit: false,
                          tentative_direction: direction(delta))
      end

      base.merge(result: { -1 => 'gap', 0 => 'match', 1 => 'exceed' }.fetch(delta <=> 0), delta: delta,
                 counts_toward_fit: true)
    end

    def direction(delta)
      { -1 => 'below', 0 => 'equal', 1 => 'above' }.fetch(delta <=> 0)
    end

    def matching_skill(vacancy_skill)
      key = PortfolioSkill.key_for(skill_id: nil, skill_label: vacancy_skill.skill_label)
      configured = portfolio_skills.reject(&:is_discovered)
      (vacancy_skill.skill_id.present? && configured.find { |s| s.skill_id == vacancy_skill.skill_id }) ||
        configured.find { |s| PortfolioSkill.key_for(skill_id: nil, skill_label: s.skill_label) == key }
    end

    # Preloaded associations are used as they are (review queue, lists), so
    # many reports can be read without a query per portfolio.
    def portfolio_skills
      @portfolio_skills ||= if @portfolio.association(:portfolio_skills).loaded?
                              @portfolio.portfolio_skills.to_a
                            else
                              @portfolio.portfolio_skills.includes(:assessor_override, :override_events).to_a
                            end
    end

    def vacancy_skills
      skills = @vacancy.vacancy_skills
      skills.loaded? ? skills.sort_by(&:id) : skills.order(:id)
    end

    def narrative_status
      return 'not_requested' if @report.nil?
      return @report.status unless @report.status == 'complete'

      @report.input_digest == input_digest ? 'complete' : 'outdated'
    end

    # A legacy template sentence is not AI text and is not shown as such.
    def ai_text(text)
      @report&.narrative_source == 'ai' ? text : nil
    end
  end
end
