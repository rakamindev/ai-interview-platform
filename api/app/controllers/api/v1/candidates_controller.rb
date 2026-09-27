# frozen_string_literal: true

module Api
  module V1
    # Lists interview sessions across assessments in the authenticated tenant.
    # One row represents one session, not one unique person.
    # Candidate-facing invite tokens and internal decision notes are not exposed.
    class CandidatesController < ApiController
      authorize_auth_token! :assessor

      # GET /api/v1/candidates?page=1&q=&assessment_id=&interview_status=&hiring_decision=
      def index
        tenant_id = current_tenant_id
        return json_error("Tenant is required", :forbidden) if tenant_id.blank?

        # Explicit tenant checks prevent cross-tenant access even when a query
        # introduces joins or the default scope changes in the future.
        base_scope = Session.where(tenant_id: tenant_id)
                            .joins(:assessment)
                            .where(assessments: { tenant_id: tenant_id })

        now = Time.current
        completed_scope = base_scope.where(status: "ended")
                                    .where.not(end_reason: "error")

        statistics = {
          total: base_scope.count,
          pending: base_scope.where(status: "pending")
                             .where("sessions.expires_at IS NULL OR sessions.expires_at > ?", now).count,
          active: base_scope.where(status: "active").count,
          completed: completed_scope.count,
          failed: base_scope.where(status: "failed").or(
            base_scope.where(status: "ended", end_reason: "error")
          ).count,
          expired: base_scope.where(status: "pending")
                             .where("sessions.expires_at <= ?", now).count,
          under_review: completed_scope.where(hiring_decision: [nil, "under_review"]).count,
          accepted: completed_scope.where(hiring_decision: "accepted").count,
          rejected: completed_scope.where(hiring_decision: "rejected").count
        }

        scope = base_scope
        if params[:q].present?
          term = "%#{ActiveRecord::Base.sanitize_sql_like(params[:q].to_s.strip)}%"
          scope = scope.where(
            "sessions.candidate_name ILIKE :term OR sessions.candidate_email ILIKE :term OR assessments.name ILIKE :term",
            term: term
          )
        end

        if params[:assessment_id].present?
          assessment_id = params[:assessment_id].to_s
          return json_error("Invalid assessment", :unprocessable_entity) unless assessment_id.match?(/\A\d+\z/)

          scope = scope.where(assessment_id: assessment_id.to_i)
        end

        case params[:interview_status].presence
        when nil, "all"
          # No status filter.
        when "pending"
          scope = scope.where(status: "pending")
                       .where("sessions.expires_at IS NULL OR sessions.expires_at > ?", now)
        when "expired"
          scope = scope.where(status: "pending")
                       .where("sessions.expires_at <= ?", now)
        when "active"
          scope = scope.where(status: "active")
        when "completed"
          scope = scope.where(status: "ended").where.not(end_reason: "error")
        when "failed"
          scope = scope.where(status: "failed").or(
            scope.where(status: "ended", end_reason: "error")
          )
        else
          return json_error("Invalid interview status", :unprocessable_entity)
        end

        case params[:hiring_decision].presence
        when nil, "all"
          # No hiring-decision filter.
        when "under_review"
          scope = scope.where(status: "ended")
                       .where.not(end_reason: "error")
                       .where(hiring_decision: [nil, "under_review"])
        when "accepted", "rejected"
          scope = scope.where(status: "ended")
                       .where.not(end_reason: "error")
                       .where(hiring_decision: params[:hiring_decision])
        else
          return json_error("Invalid hiring decision", :unprocessable_entity)
        end

        page = [params[:page].to_i, 1].max
        sessions = scope.includes(:assessment)
                        .order(created_at: :desc, id: :desc)
                        .page(page).per(10)

        assessments = Assessment.where(tenant_id: tenant_id)
                                .order(:name)
                                .pluck(:id, :name)
                                .map { |id, name| { id: id, name: name } }

        json_response(
          candidates: sessions.map { |session| candidate_json(session) },
          assessments: assessments,
          meta: {
            current_page: sessions.current_page,
            total_pages: sessions.total_pages,
            total_count: sessions.total_count,
            per_page: sessions.limit_value,
            statistics: statistics
          }
        )
      end

      private

      def candidate_json(session)
        {
          id: session.id,
          assessment_id: session.assessment_id,
          assessment_name: session.assessment.name,
          candidate_id: session.candidate_id,
          candidate_name: session.candidate_name,
          candidate_email: session.candidate_email,
          status: session.status,
          end_reason: session.end_reason,
          hiring_decision: session.hiring_decision,
          started_at: session.started_at,
          ended_at: session.ended_at,
          expires_at: session.expires_at,
          created_at: session.created_at
        }
      end
    end
  end
end
