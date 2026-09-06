# frozen_string_literal: true

module Api
  module V1
    module Portfolios
      class HiringDecisionsController < ApiController
        authorize_auth_token! :assessor

        before_action :set_portfolio

        def show
          render json: { hiring_decision: serialize_decision(@portfolio.hiring_decision) }
        end

        def create
          if @portfolio.hiring_decision.present?
            return render json: {
              error: 'Hiring decision has already been recorded and cannot be changed. This is an intentional design for auditability.'
            }, status: :conflict
          end

          decision = HiringDecision.create!(
            portfolio:  @portfolio,
            decided_by: current_user.id,
            tenant_id:  current_tenant_id,
            decision:   params.require(:decision),
            rationale:  params.require(:rationale),
            ip_address: request.remote_ip,
            user_agent: request.user_agent&.first(500),
            decided_at: Time.current
          )

          render json: { hiring_decision: serialize_decision(decision) }, status: :created
        rescue ActionController::ParameterMissing => e
          render json: { error: "Required parameter: #{e.param}" }, status: :unprocessable_entity
        rescue ActiveRecord::RecordInvalid => e
          render json: { error: e.record.errors.full_messages.join(', ') }, status: :unprocessable_entity
        end

        private

        def set_portfolio
          @portfolio = Portfolio.find(params[:portfolio_id])
        rescue ActiveRecord::RecordNotFound
          render json: { error: 'Portfolio not found.' }, status: :not_found
        end

        def serialize_decision(decision)
          return nil if decision.nil?

          {
            id:           decision.id,
            decision:     decision.decision,
            rationale:    decision.rationale,
            decided_by:   decision.decided_by,
            decided_at:   decision.decided_at.iso8601,
            ip_address:   decision.ip_address,
            is_immutable: true
          }
        end
      end
    end
  end
end
