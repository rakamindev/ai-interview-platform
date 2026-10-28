# frozen_string_literal: true

module Api
  module V1
    class PortfolioSkillsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_portfolio_skill

      def override
        existing = @portfolio_skill.assessor_override
        attributes = override_params.merge(
          ai_level: @portfolio_skill.ai_level,
          overridden_by: current_user.id,
          overridden_at: Time.current
        )

        override = nil
        saved = AssessorOverride.transaction do
          override = existing || @portfolio_skill.build_assessor_override
          override.update(attributes)
        end

        if saved
          refresh_related_fitgap_reports
          status = existing ? :ok : :created
          json_response({ override: override_json(override) }, status)
        else
          json_error(override.errors.full_messages.first, :unprocessable_entity)
        end
      end

      private

      def refresh_related_fitgap_reports
        portfolio = @portfolio_skill.portfolio
        FitGapReport.where(portfolio_id: portfolio.id).find_each do |report|
          report.update!(generation_status: "stale", generation_error: nil)
          scheduled = FitGap::ReportScheduler.enqueue(portfolio: portfolio, vacancy: report.vacancy)
          next if scheduled && !scheduled.failed?

          Rails.logger.warn("[N13] Fit/gap report requires manual retry after assessor override")
        rescue StandardError => e
          # Preserve the saved human override. The report remains stale/failed and
          # the next report request can retry without losing the assessor action.
          report.update_columns(
            generation_status: "failed",
            generation_error: "Report refresh could not be scheduled",
            generation_started_at: nil
          )
          Rails.logger.error("[N13] Fit/gap refresh after override failed: #{e.class}")
        end
      end

      def set_portfolio_skill
        @portfolio_skill = PortfolioSkill.joins(portfolio: :session)
                                         .where(sessions: { tenant_id: current_tenant_id })
                                         .find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio skill not found", :not_found)
      end

      def override_params
        params.require(:override).permit(:override_level, :assessor_notes)
      end

      def override_json(override)
        {
          id: override.id,
          portfolio_skill_id: override.portfolio_skill_id,
          ai_level: override.ai_level,
          override_level: override.override_level,
          assessor_notes: override.assessor_notes,
          overridden_by: override.overridden_by,
          overridden_at: override.overridden_at
        }
      end
    end
  end
end
