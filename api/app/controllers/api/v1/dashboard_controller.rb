# frozen_string_literal: true

module Api
  module V1
    class DashboardController < ApiController
      authorize_auth_token! :portal

      # GET /api/v1/dashboard/stats
      def stats
        tenant_sessions = Session.includes(:assessment, :portfolio).where(tenant_id: current_tenant_id)

        live = tenant_sessions.where(status: 'active').order(started_at: :desc)
        awaiting = tenant_sessions.joins(:portfolio)
                                  .where(status: 'ended', portfolios: { generation_status: 'complete' })
                                  .order(ended_at: :desc)
        recent = tenant_sessions.order(created_at: :desc).limit(6)

        json_response(
          live_count: live.count,
          live_sessions: live.limit(5).map(&method(:session_summary)),
          awaiting_review_count: awaiting.count,
          awaiting_review_sessions: awaiting.limit(5).map(&method(:session_summary)),
          total_assessments: Assessment.where(tenant_id: current_tenant_id).count,
          total_sessions: tenant_sessions.count,
          total_vacancies: Vacancy.where(tenant_id: current_tenant_id).count,
          recent_sessions: recent.map(&method(:session_summary))
        )
      end

      private

      def session_summary(session)
        {
          id:              session.id,
          assessment_id:   session.assessment_id,
          assessment_name: session.assessment&.name,
          candidate_name:  session.candidate_name,
          status:          session.status,
          end_reason:      session.end_reason,
          started_at:      session.started_at,
          ended_at:        session.ended_at,
          created_at:      session.created_at,
          portfolio_id:    session.portfolio&.id,
          portfolio_status: session.portfolio&.generation_status
        }
      end
    end
  end
end
