# frozen_string_literal: true

module Portfolios
  class DecisionLifecycle
    class Error < StandardError; end
    class InvalidTransition < Error; end
    class InvalidDecision < Error; end

    def initialize(portfolio:, actor:)
      @portfolio = portfolio
      @actor = actor
    end

    def finalize(outcome:, note:)
      normalized_outcome = outcome.to_s.downcase
      normalized_note = note.to_s.strip.presence
      validate_outcome!(normalized_outcome)

      PortfolioDecision.transaction do
        @portfolio.with_lock do
          raise InvalidTransition, 'Portfolio must finish generating before a decision can be finalized' unless @portfolio.complete?

          decision = @portfolio.portfolio_decision || @portfolio.build_portfolio_decision
          decision.lock! if decision.persisted?
          raise InvalidTransition, 'Decision is already finalized. Reopen it before changing the outcome.' if decision.finalized?

          if rationale_required?(decision, normalized_outcome) && normalized_note.blank?
            raise InvalidDecision, 'A finalization note is required when overriding AI or finalizing a legacy result'
          end

          decision.update!(
            final_outcome:      normalized_outcome,
            finalization_note:  normalized_note,
            finalized_by_id:    @actor.id,
            finalized_at:       Time.current
          )
          decision.portfolio_decision_events.create!(
            event_type: 'admin_finalized',
            outcome:    normalized_outcome,
            note:       normalized_note,
            actor_id:   @actor.id
          )

          decision
        end
      end
    end

    def reopen(note:)
      normalized_note = note.to_s.strip.presence
      raise InvalidDecision, 'A reopen reason is required' if normalized_note.blank?

      PortfolioDecision.transaction do
        @portfolio.with_lock do
          decision = @portfolio.portfolio_decision
          raise InvalidTransition, 'Decision has not been finalized' unless decision&.finalized?

          decision.lock!
          decision.update!(
            final_outcome:     nil,
            finalization_note: nil,
            finalized_by:      nil,
            finalized_at:      nil
          )
          decision.portfolio_decision_events.create!(
            event_type: 'admin_reopened',
            note:       normalized_note,
            actor_id:   @actor.id
          )

          decision
        end
      end
    end

    private

    def validate_outcome!(outcome)
      return if PortfolioDecision::OUTCOMES.include?(outcome)

      raise InvalidDecision, 'Decision outcome must be pass or fail'
    end

    def rationale_required?(decision, outcome)
      !decision.ai_recommendation_available? || decision.ai_outcome != outcome
    end
  end
end
