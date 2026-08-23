# frozen_string_literal: true

module Api
  module V1
    class OverrideEventsController < ApiController
      authorize_auth_token! :assessor

      # GET /api/v1/portfolio_skills/:id/override_events
      # Nested under a `member do` block, so the parent param is :id, not
      # :portfolio_skill_id — Rails only prefixes the parent key when the
      # child is declared as a genuinely separate nested resource, not when
      # it's tucked inside the parent's own member block.
      def index
        events = AssessorOverrideEvent
          .joins(:portfolio_skill)
          .where(portfolio_skill_id: params[:id])
          .order(overridden_at: :asc)

        json_response(override_events: events.map { |e| event_json(e) })
      end

      # GET /api/v1/override_events
      # Tenant-wide, filterable, paginated audit log (Audit Override History page).
      def audit
        events = AssessorOverrideEvent
          .joins(portfolio_skill: { portfolio: :session })
          .includes(portfolio_skill: { portfolio: { session: :assessment } })
          .order(overridden_at: :desc)

        if params[:assessor_email].present?
          assessor_ids = User.where("email ILIKE ?", "%#{params[:assessor_email]}%").select(:id)
          events = events.where(overridden_by: assessor_ids)
        end
        events = events.where(assessor_override_events: { overridden_at: params[:date_from].. }) if params[:date_from].present?
        events = events.where(assessor_override_events: { overridden_at: ..params[:date_to] }) if params[:date_to].present?
        events = events.where("portfolio_skills.skill_label ILIKE ?", "%#{params[:skill_label]}%") if params[:skill_label].present?

        events = paginate(events)
        assessor_emails = User.where(id: events.map(&:overridden_by)).pluck(:id, :email).to_h

        json_response(
          override_events: events.map { |e| audit_event_json(e, assessor_emails) },
          meta: pagination_meta(events)
        )
      end

      private

      def audit_event_json(event, assessor_emails)
        skill = event.portfolio_skill
        session = skill.portfolio.session

        {
          id: event.id,
          portfolio_skill_id: event.portfolio_skill_id,
          skill_label: skill.skill_label,
          candidate_name: session.candidate_name,
          assessment_name: session.assessment.name,
          ai_level: event.ai_level,
          override_level: event.override_level,
          assessor_notes: event.assessor_notes,
          overridden_by: event.overridden_by,
          assessor_email: assessor_emails[event.overridden_by],
          overridden_at: event.overridden_at
        }
      end

      def pagination_meta(collection)
        {
          current_page: collection.current_page,
          total_pages: collection.total_pages,
          total_count: collection.total_count,
          per_page: collection.limit_value
        }
      end

      def event_json(event)
        {
          id: event.id,
          portfolio_skill_id: event.portfolio_skill_id,
          ai_level: event.ai_level,
          override_level: event.override_level,
          assessor_notes: event.assessor_notes,
          overridden_by: event.overridden_by,
          overridden_at: event.overridden_at
        }
      end
    end
  end
end
