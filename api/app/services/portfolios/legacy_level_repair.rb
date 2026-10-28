# frozen_string_literal: true

module Portfolios
  # One-off repair for portfolios generated before skills could be "not
  # assessed". Back then a skill the interview never reached was stored with a
  # level (L1 when the model returned none), and fit/gap counted it as a gap.
  #
  # A row is repaired only when the session's own coverage map shows the skill
  # was never probed (probe_count 0). Assessor overrides are kept: a person's
  # rating still stands. Fit/gap reports built from repaired portfolios are
  # deleted and re-queued so they stop reporting a gap.
  class LegacyLevelRepair
    Result = Struct.new(:skill_ids, :portfolio_ids, keyword_init: true)

    def initialize(apply: false, logger: Rails.logger)
      @apply  = apply
      @logger = logger
    end

    def call
      skills = candidates.to_a
      result = Result.new(skill_ids: skills.map(&:id), portfolio_ids: skills.map(&:portfolio_id).uniq)

      @logger.info("[LegacyLevelRepair] #{@apply ? 'Repairing' : 'Would repair'} #{skills.size} skills " \
                   "in #{result.portfolio_ids.size} portfolios")
      repair(skills, result.portfolio_ids) if @apply && skills.any?
      result
    end

    private

    def candidates
      PortfolioSkill
        .where(assessment_status: 'assessed', is_discovered: false)
        .joins(portfolio: :session)
        .joins(<<~SQL.squish)
          INNER JOIN coverage_maps
            ON coverage_maps.session_id = sessions.id
           AND coverage_maps.is_discovered = FALSE
           AND LOWER(coverage_maps.skill_label) = LOWER(portfolio_skills.skill_label)
        SQL
        .where(coverage_maps: { probe_count: 0 })
    end

    def repair(skills, portfolio_ids)
      summary = ResponseNormalizer::NOT_ASSESSED_SUMMARIES.fetch(ResponseNormalizer::REASON_NEVER_REACHED)

      PortfolioSkill.transaction do
        PortfolioSkill.where(id: skills.map(&:id)).update_all(
          assessment_status: 'not_assessed', status_reason: ResponseNormalizer::REASON_NEVER_REACHED,
          ai_level: nil, ai_confidence: nil, evidence: [], evidence_refs: [],
          coverage_state: 'not_yet', probe_count: 0, competency_summary: summary
        )
        AssessorOverride.where(portfolio_skill_id: skills.map(&:id)).update_all(ai_level: nil)

        stale = FitGapReport.where(portfolio_id: portfolio_ids).pluck(:portfolio_id, :vacancy_id)
        FitGapReport.where(portfolio_id: portfolio_ids).delete_all
        stale.each { |portfolio_id, vacancy_id| FitGapGeneratorWorker.perform_async(portfolio_id, vacancy_id) }
      end
    end
  end
end
