# frozen_string_literal: true

module Api
  module V1
    class PortfolioSkillsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_portfolio_skill

      # POST /api/v1/portfolio-skills/:id/override
      def override
        existing = @portfolio_skill.assessor_override
        override = existing || @portfolio_skill.build_assessor_override

        if override.update(
          override_params.merge(
            ai_level:      @portfolio_skill.ai_level,
            overridden_by: current_user.id,
            overridden_at: Time.current
          )
        )
          @portfolio_skill.portfolio.update_column(:generated_at, Time.current)
          regenerate_stale_fitgap_reports
          json_response({ override: override_json(override) }, existing ? :ok : :created)
        else
          json_error(override.errors.full_messages.first, :unprocessable_entity)
        end
      end

      private


      # An override invalidates every stored comparison for this portfolio. The
      # engine upserts on (portfolio_id, vacancy_id), so the queued work overwrites
      # each report in place and the last trustworthy version stays readable until
      # its replacement lands.
      def regenerate_stale_fitgap_reports
        portfolio = @portfolio_skill.portfolio

        FitGapReport.where(portfolio_id: portfolio.id).pluck(:vacancy_id).each do |vacancy_id|
          FitGapGeneratorWorker.perform_async(portfolio.id, vacancy_id)
        end
      end


      def set_portfolio_skill
        @portfolio_skill = Authorization::PortfolioAccess.find_portfolio_skill!(
          params[:id],
          tenant_id: current_tenant_id
        )
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio skill not found", :not_found)
      end

      def override_params
        params.require(:override).permit(:override_level, :assessor_notes)
      end

      def override_json(override)
        {
          id:                 override.id,
          portfolio_skill_id: override.portfolio_skill_id,
          ai_level:           override.ai_level,
          override_level:     override.override_level,
          assessor_notes:     override.assessor_notes,
          overridden_by:      override.overridden_by,
          overridden_at:      override.overridden_at
        }
      end
    end
  end
end
