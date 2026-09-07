# frozen_string_literal: true

module Api
  module V1
    class HiringDecisionsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_portfolio

      # GET /api/v1/portfolios/:portfolio_id/hiring_decision
      def show
        decision = @portfolio.hiring_decision

        json_response(hiring_decision: decision && decision_json(decision))
      end

      # POST /api/v1/portfolios/:portfolio_id/hiring_decision
      def create
        if @portfolio.hiring_decision
          # Not an error in the usual sense. Someone already decided, and the
          # right answer is to show them what was decided rather than to
          # overwrite it or pretend nothing happened.
          return json_response(
            { error: 'A decision has already been recorded for this candidate',
              hiring_decision: decision_json(@portfolio.hiring_decision) },
            :conflict
          )
        end

        decision = @portfolio.build_hiring_decision(
          decision_params.merge(
            levels_at_decision: HiringDecision.snapshot_of(@portfolio),
            decided_by:         current_user.id,
            decided_at:         Time.current,
            ip_address:         request.remote_ip,
            user_agent:         request.user_agent.to_s[0, 255]
          )
        )

        if decision.save
          json_response({ hiring_decision: decision_json(decision) }, :created)
        else
          json_error(decision.errors.full_messages.first, :unprocessable_entity)
        end
      rescue ActiveRecord::RecordNotUnique
        json_response(
          { error: 'A decision has already been recorded for this candidate',
            hiring_decision: decision_json(@portfolio.reload.hiring_decision) },
          :conflict
        )
      end

      private

      # Same scoping as every other portfolio lookup: Portfolio carries no
      # tenant_id, only Session does, so the join has to reach that far.
      def set_portfolio
        @portfolio = Portfolio.joins(:session)
                              .where(sessions: { tenant_id: current_tenant_id })
                              .find(params[:portfolio_id])
      rescue ActiveRecord::RecordNotFound
        json_error('Portfolio not found', :not_found)
      end

      def decision_params
        params.require(:hiring_decision).permit(:decision, :rationale)
      end

      def decision_json(decision)
        {
          id:                 decision.id,
          portfolio_id:       decision.portfolio_id,
          decision:           decision.decision,
          rationale:          decision.rationale,
          levels_at_decision: decision.levels_at_decision,
          decided_by:         decision.decided_by,
          decided_at:         decision.decided_at
        }
      end
    end
  end
end
