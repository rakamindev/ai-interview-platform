# frozen_string_literal: true

module Api
  module V1
    class PortfolioSkillsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_portfolio_skill

      # POST /api/v1/portfolio-skills/:id/override
      def override
        existing = @portfolio_skill.assessor_override

        if existing
          if existing.update(override_params.merge(overridden_by: current_user.id, overridden_at: Time.current))
            refresh_fitgap_reports
            json_response(override: override_json(existing))
          else
            json_error(existing.errors.full_messages.first, :unprocessable_entity)
          end
        else
          new_override = @portfolio_skill.build_assessor_override(
            override_params.merge(
              ai_level:      @portfolio_skill.ai_level,
              overridden_by: current_user.id,
              overridden_at: Time.current
            )
          )

          if new_override.save
            refresh_fitgap_reports
            json_response({ override: override_json(new_override) }, :created)
          else
            json_error(new_override.errors.full_messages.first, :unprocessable_entity)
          end
        end
      end

      private

      # An override changes the facts, not just the prose: recompute every comparison now (cheap,
      # deterministic) so the assessor never sees a stale or missing table, and refresh narratives in
      # the background. Vacancies that are no longer visible to this tenant are skipped.
      def refresh_fitgap_reports
        portfolio = @portfolio_skill.portfolio
        FitGapReport.where(portfolio_id: portfolio.id).find_each do |report|
          vacancy = Vacancy.find_by(id: report.vacancy_id)
          next unless vacancy

          refreshed = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).refresh_comparisons!
          FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id) if refreshed.narrative_pending?
        end
      end

      # PortfolioSkill is tenant-scoped through portfolio -> session, never by id alone.
      def set_portfolio_skill
        visible = Portfolio.where(session_id: Session.select(:id)).select(:id)
        @portfolio_skill = PortfolioSkill.where(portfolio_id: visible).find_by(id: params[:id])
        json_error("Portfolio skill not found", :not_found) unless @portfolio_skill
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
