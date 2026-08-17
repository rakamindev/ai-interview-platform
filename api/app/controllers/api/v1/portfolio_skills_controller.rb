# frozen_string_literal: true

module Api
  module V1
    class PortfolioSkillsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_portfolio_skill

      # PUT /api/v1/portfolio_skills/:id/review
      # Idempotent upsert of an assessor review for a skill evaluation.
      #
      #   review: {
      #     outcome:        "confirmed" | "adjusted" | "insufficient_evidence",
      #     reviewed_level: 1..5,              # required when adjusted
      #     rationale:      "string"            # required when adjusted / insufficient_evidence
      #   }
      def review
        outcome        = params.dig(:review, :outcome)
        reviewed_level = params.dig(:review, :reviewed_level)
        rationale      = params.dig(:review, :rationale)

        override = @portfolio_skill.assessor_override ||
                   @portfolio_skill.build_assessor_override(ai_level: @portfolio_skill.ai_level)

        assign_review_attributes(override, outcome, reviewed_level, rationale)

        if override.save
          regenerate_stale_fitgap_reports
          json_response(review: override_json(override))
        else
          json_error(override.errors.full_messages.first, :unprocessable_entity)
        end
      end

      # POST /api/v1/portfolio_skills/:id/override
      # Legacy compatibility adapter — maps to `adjusted` outcome.
      def override
        override_level = params.dig(:override, :override_level)
        notes          = params.dig(:override, :assessor_notes)

        override = @portfolio_skill.assessor_override ||
                   @portfolio_skill.build_assessor_override(ai_level: @portfolio_skill.ai_level)

        assign_review_attributes(override, 'adjusted', override_level, notes)

        if override.save
          regenerate_stale_fitgap_reports
          json_response(override: override_json(override))
        else
          json_error(override.errors.full_messages.first, :unprocessable_entity)
        end
      end

      private

      def assign_review_attributes(override, outcome, reviewed_level, rationale)
        override.outcome        = outcome
        override.reviewed_level = outcome == 'confirmed' ? nil : reviewed_level
        override.rationale      = rationale.presence
        override.reviewed_by    = current_user.id
        override.reviewed_at    = Time.current
        # Legacy NOT NULL column — mirror the reviewer for backward compatibility.
        override.overridden_by  = current_user.id
        override.overridden_at  = Time.current
      end

      def regenerate_stale_fitgap_reports
        portfolio = @portfolio_skill.portfolio
        FitGapReport.where(portfolio_id: portfolio.id).each do |report|
          vacancy_id = report.vacancy_id
          report.destroy
          FitGapGeneratorWorker.perform_async(portfolio.id, vacancy_id)
        end
      end

      def set_portfolio_skill
        # Scope through the tenant-scoped Portfolio so cross-tenant skill IDs 404.
        @portfolio_skill = PortfolioSkill.joins(portfolio: :session)
                                         .merge(Portfolio.where(tenant_id: Current.tenant_id))
                                         .find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio skill not found", :not_found)
      end

      def override_json(override)
        {
          id:                  override.id,
          portfolio_skill_id:  override.portfolio_skill_id,
          ai_level:            override.ai_level,
          outcome:             override.outcome,
          reviewed_level:      override.reviewed_level,
          effective_level:     override.effective_level,
          rationale:           override.rationale,
          reviewed_by:         override.reviewed_by,
          reviewed_at:         override.reviewed_at
        }
      end
    end
  end
end
