# frozen_string_literal: true

module Api
  module V1
    class PortfolioSkillsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_portfolio_skill

      # POST /api/v1/portfolio_skills/:id/override
      def override
        override_level = params.dig(:override, :override_level)
        assessor_notes = params.dig(:override, :assessor_notes)

        # AC-S2: input validation
        unless override_level.present? && override_level.to_s.match?(/\A[1-5]\z/)
          return json_error("override_level must be an integer between 1 and 5", :unprocessable_entity)
        end

        if assessor_notes.blank? || assessor_notes.to_s.strip.empty?
          return json_error("assessor_notes cannot be blank", :unprocessable_entity)
        end

        if assessor_notes.to_s.length > 2000
          return json_error("assessor_notes cannot exceed 2000 characters", :unprocessable_entity)
        end

        existing = @portfolio_skill.assessor_override

        if existing
          if existing.update(
            override_level: override_level.to_i,
            assessor_notes: assessor_notes.to_s.strip,
            overridden_by:  current_user.id,
            overridden_at:  Time.current
          )
            regenerate_stale_fitgap_reports
            json_response(override: override_json(existing))
          else
            json_error(existing.errors.full_messages.first, :unprocessable_entity)
          end
        else
          new_override = @portfolio_skill.build_assessor_override(
            override_level: override_level.to_i,
            assessor_notes: assessor_notes.to_s.strip,
            ai_level:       @portfolio_skill.ai_level, # can be nil for unassessed skill
            overridden_by:  current_user.id,
            overridden_at:  Time.current
          )

          if new_override.save
            regenerate_stale_fitgap_reports
            json_response({ override: override_json(new_override) }, :created)
          else
            json_error(new_override.errors.full_messages.first, :unprocessable_entity)
          end
        end
      end

      private

      def regenerate_stale_fitgap_reports
        portfolio = @portfolio_skill.portfolio
        # AC-F6 & AC-W6: Do not destroy the existing report; it will be marked stale: true until regenerated.
        FitGapReport.where(portfolio_id: portfolio.id).each do |report|
          FitGapGeneratorWorker.perform_async(portfolio.id, report.vacancy_id)
        end
      end

      # AC-S1: Scope to current tenant. Return 404 if not found or from another tenant.
      def set_portfolio_skill
        @portfolio_skill = PortfolioSkill.joins(portfolio: :session)
                                         .where(sessions: { tenant_id: Current.tenant_id })
                                         .find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio skill not found", :not_found)
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
