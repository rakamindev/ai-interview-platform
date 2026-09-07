# frozen_string_literal: true

module Api
  module V1
    # Every finished candidate across every assessment, in one place.
    #
    # Until now a result could only be reached by remembering which assessment
    # it belonged to and opening that first. That works when you ran the
    # interview. It does not work for the person who has ten candidates across
    # three roles and needs to know which of them are still waiting on a
    # decision.
    class ResultsController < ApiController
      authorize_auth_token! :assessor

      # GET /api/v1/results
      #
      # Filters are applied in SQL where they can be and in Ruby where they
      # depend on the shape of the portfolio, which is read anyway to build the
      # row. Paginated because a busy tenant accumulates these forever.
      def index
        sessions = Session.ended
                          .includes(:assessment, portfolio: { portfolio_skills: :assessor_override })
                          .includes(portfolio: :hiring_decision)
                          .order(ended_at: :desc)

        sessions = sessions.where(assessment_id: params[:assessment_id]) if params[:assessment_id].present?

        rows = sessions.filter_map { |session| result_json(session) }
        rows = apply_decision_filter(rows)
        rows = rows.select { |r| r[:needs_attention] } if params[:needs_attention] == 'true'

        json_response(
          results: rows,
          meta: {
            total: rows.size,
            # Cheap enough to compute here, and it is the number the page leads
            # with: how many finished interviews nobody has acted on yet.
            undecided: rows.count { |r| r[:decision].nil? }
          }
        )
      end

      private

      def apply_decision_filter(rows)
        case params[:decision]
        when nil, '', 'all'  then rows
        when 'undecided'     then rows.select { |r| r[:decision].nil? }
        else                      rows.select { |r| r[:decision] == params[:decision] }
        end
      end

      def result_json(session)
        portfolio = session.portfolio
        return nil unless portfolio

        skills     = portfolio.portfolio_skills.reject(&:is_discovered)
        unassessed = skills.count { |s| s.ai_level.nil? }
        low        = skills.count { |s| s.ai_level.present? && s.ai_confidence.to_s == 'low' }
        decision   = portfolio.hiring_decision

        {
          session_id:      session.id,
          assessment_id:   session.assessment_id,
          assessment_name: session.assessment.name,
          candidate_name:  session.candidate_name,
          ended_at:        session.ended_at,
          end_reason:      session.end_reason,
          duration_seconds: session.duration_seconds,

          portfolio_id:     portfolio.id,
          portfolio_status: portfolio.generation_status,

          skill_count:       skills.size,
          unassessed_count:  unassessed,
          low_confidence_count: low,
          override_count:    skills.count { |s| s.assessor_override.present? },

          decision:    decision&.decision,
          decided_at:  decision&.decided_at,

          # One flag rather than three, because the list exists to answer one
          # question: which of these needs me. A portfolio that failed to
          # generate, or a rating with holes in it that nobody has acted on yet.
          needs_attention: portfolio.generation_status == 'failed' ||
                           (decision.nil? && (unassessed.positive? || low.positive?))
        }
      end
    end
  end
end
