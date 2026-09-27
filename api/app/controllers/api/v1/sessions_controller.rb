# frozen_string_literal: true

module Api
  module V1
    class SessionsController < ApiController
      authorize_auth_token! :assessor, except: %i[candidate_info audio_complete]
      skip_before_action :require_tenant!, only: %i[candidate_info audio_complete]

      before_action :set_session, only: %i[
        show
  destroy
  end_session
  extend_invitation
  update_decision
  coverage
  transcript
      ]

      # GET /api/v1/assessments/:assessment_id/sessions
      # def index
      #   assessment = Assessment.find(params[:assessment_id])
      #   sessions = assessment.sessions.order(created_at: :desc)
      #
      #   json_response(sessions: sessions.map(&method(:session_json)))
      # rescue ActiveRecord::RecordNotFound
      #   json_error("Assessment not found", :not_found)
      # end

      def index
        assessment = Assessment.find(params[:assessment_id])

        base_scope = assessment.sessions

        status_counts = base_scope
          .group(:status)
          .count
          .transform_keys(&:to_s)

        ended_error_count = base_scope
          .where(
            status: "ended",
            end_reason: "error"
          )
          .count

        ended_count = status_counts.fetch("ended", 0)
        failed_status_count = status_counts.fetch("failed", 0)

        session_counts = {
          total: status_counts.values.sum,
          pending: status_counts.fetch("pending", 0),
          active: status_counts.fetch("active", 0),
          completed: [ended_count - ended_error_count, 0].max,
          failed: failed_status_count + ended_error_count,
          by_status: status_counts
        }

        scope = base_scope.order(created_at: :desc)

        if params[:q].present?
          search = ActiveRecord::Base.sanitize_sql_like(
            params[:q].strip
          )

          scope = scope.where(
            "sessions.candidate_name ILIKE ?",
            "%#{search}%"
          )
        end

        sessions = paginate(scope)

        json_response(
          sessions: sessions.map(&method(:session_json)),
          meta: pagination_meta(sessions).merge(
            session_counts: session_counts
          )
        )
      rescue ActiveRecord::RecordNotFound
        json_error("Assessment not found", :not_found)
      end

      # POST /api/v1/assessments/:assessment_id/sessions
      def create
        assessment = Assessment.find(params[:assessment_id])

        custom_expires_at = params.dig(
          :session,
          :expires_at
        ).presence

        expiration_days = nil

        if custom_expires_at
          unless custom_expires_at.match?(/(?:Z|[+-]\d{2}:\d{2})\z/i)
            return json_error(
              "Custom expiration must include a timezone",
              :unprocessable_entity
            )
          end

          begin
            expires_at = Time.iso8601(custom_expires_at)
          rescue ArgumentError
            return json_error(
              "Invalid custom expiration date",
              :unprocessable_entity
            )
          end

          if expires_at <= Time.current
            return json_error(
              "Expiration must be in the future",
              :unprocessable_entity
            )
          end
        else
          expiration_days = params
            .dig(:session, :expiration_days)
            .presence || 3

          unless %w[1 3 7].include?(expiration_days.to_s)
            return json_error(
              "Expiration must be 1, 3, or 7 days",
              :unprocessable_entity
            )
          end

          expires_at = Time.current + expiration_days.to_i.days
        end

        session = assessment.sessions.new(
          candidate_id: params.dig(
            :session,
            :candidate_id
          ),
          candidate_name: params.dig(
            :session,
            :candidate_name
          ).presence,
          candidate_email: params.dig(
            :session,
            :candidate_email
          ),
          expires_at: expires_at,
          tenant_id: current_tenant_id
        )

        if session.save
          dispatch_invitation_email(session)

          schedule_invitation_reminder(session)

          json_response(
            {
              session: session_json(session),
              invite_url: session.invite_url
            },
            :created
          )
        else
          json_error(
            session.errors.full_messages.first,
            :unprocessable_entity
          )
        end
      rescue ActiveRecord::RecordNotFound
        json_error("Assessment not found", :not_found)
      end

      # GET /api/v1/sessions/:id
      def show
        json_response(
          session: session_json(@session).merge(
            assessment: {
              id: @session.assessment.id,
              name: @session.assessment.name,
              time_limit_min: @session.assessment.time_limit_min
            }
          )
        )
      end

      # DELETE /api/v1/sessions/:id
      def destroy
        if @session.active?
          return json_error(
            "Active candidate session cannot be deleted",
            :unprocessable_entity
          )
        end

        if @session.destroy
          json_response(
            message: "Candidate session deleted"
          )
        else
          json_error(
            @session.errors.full_messages.first ||
              "Failed to delete candidate session",
            :unprocessable_entity
          )
        end
      end

      # POST /api/v1/sessions/:id/extend
      def extend_invitation
        expiration_days = params
          .dig(:session, :expiration_days)
          .to_s

        unless %w[1 3 7].include?(expiration_days)
          return json_error(
            "Expiration must be 1, 3, or 7 days",
            :unprocessable_entity
          )
        end

        unless @session.pending?
          return json_error(
            "Only pending invitations can be extended",
            :unprocessable_entity
          )
        end

        @session.with_lock do
          unless @session.pending?
            raise ActiveRecord::RecordInvalid.new(@session)
          end

          @session.update!(
            expires_at: Time.current + expiration_days.to_i.days,
            reminder_sent_at: nil
          )
        end

        schedule_invitation_reminder(@session)

        json_response(
          session: session_json(@session.reload),
          message: "Invitation extended successfully"
        )
      rescue ActiveRecord::RecordInvalid
        json_error(
          "Only pending invitations can be extended",
          :unprocessable_entity
        )
      end

      # POST /api/v1/sessions/:id/end
      def end_session
        if @session.ended?
          return json_error(
            "Session is already ended",
            :unprocessable_entity
          )
        end

        reason = params.dig(
          :session,
          :reason
        ) || "manual_assessor"

        unless Session::END_REASONS.include?(reason)
          return json_error(
            "Invalid end reason",
            :unprocessable_entity
          )
        end

        result = Sessions::EndHandler
          .new(@session)
          .call(reason: reason)

        if result
          json_response(
            session: session_json(@session.reload)
          )
        else
          json_error(
            "Failed to end session",
            :unprocessable_entity
          )
        end
      end

      # GET /api/v1/sessions/:id/coverage
      def coverage
        maps = @session
          .coverage_maps
          .configured
          .order(:id)

        discovered = @session
          .coverage_maps
          .discovered
          .order(:id)

        json_response(
          skills: maps.map(
            &method(:coverage_map_json)
          ),
          discovered: discovered.map(
            &method(:coverage_map_json)
          ),
          updated_at: @session.coverage_maps.maximum(
            :updated_at
          )
        )
      end

      # GET /api/v1/sessions/:id/transcript
      def transcript
        from_turn = params[:from_turn].to_i

        turns = @session.transcript_turns.ordered

        if from_turn > 0
          turns = turns.where(
            "turn_number >= ?",
            from_turn
          )
        end

        json_response(
          turns: turns.map do |turn|
            {
              id: turn.id,
              turn_number: turn.turn_number,
              speaker: turn.speaker,
              text: turn.text,
              audio_start_ms: turn.audio_start_ms,
              audio_end_ms: turn.audio_end_ms,
              created_at: turn.created_at
            }
          end,
          total: turns.count
        )
      end

      # POST /sessions/:token/audio_complete  — no JWT, invite token in URL
      # Called by the frontend when the audio queue drains after a preparing_to_end signal.
      # Ends the session if all coverage is complete; idempotent if already ended.
      def audio_complete
        session = Session.unscoped.find_by(
          invite_token: params[:token]
        )

        unless session
          return json_error(
            "Invalid or expired invite token",
            :not_found
          )
        end

        if session.ended?
          return json_response(
            ended: true,
            message: "Session already ended"
          )
        end

        # No coverage re-check here. The backend WS already verified all_covered
        # before sending preparing_to_end. Re-checking here caused false negatives
        # (timing gap between WS detection and HTTP call) that stalled auto-end.
        Sessions::EndHandler
          .new(session)
          .call(reason: "all_covered")

        json_response(
          ended: true,
          message: "Session ended"
        )
      end

      # GET /sessions/:token/candidate  — no JWT, invite token in URL
      def candidate_info
        session = Session.unscoped.find_by(
          invite_token: params[:token]
        )

        unless session
          return json_error(
            "Invalid or expired invite token",
            :not_found
          )
        end

        # Resolve tenant from the session's own tenant_id so we can load the assessment
        assessment = Assessment.unscoped
          .where(
            tenant_id: session.tenant_id
          )
          .find_by(
            id: session.assessment_id
          )

        unless assessment
          return json_error(
            "Assessment not found",
            :not_found
          )
        end

        json_response(
          session_id: session.id,
          role_title: assessment.name,
          time_limit_min: assessment.time_limit_min,
          session_status: session.status,
          expires_at: session.expires_at,
          invitation_expired: session.invitation_expired?
        )
      end

      # PATCH /api/v1/sessions/:id/decision
# Records an internal HR hiring decision after the interview is completed.
# This action does not send emails or change the interview session status.
def update_decision
  decision = params.dig(
    :session,
    :hiring_decision
  ).to_s

  unless Session::HIRING_DECISIONS.include?(decision)
    return json_error(
      "Invalid hiring decision",
      :unprocessable_entity
    )
  end

  notes = params.dig(
    :session,
    :decision_notes
  )

  if notes.present? && notes.to_s.length > 2000
    return json_error(
      "Decision notes must not exceed 2000 characters",
      :unprocessable_entity
    )
  end

  unless @session.interview_completed?
    return json_error(
      "Hiring decision can only be updated after a completed interview",
      :unprocessable_entity
    )
  end

  @session.with_lock do
    unless @session.interview_completed?
      raise ActiveRecord::RecordInvalid.new(@session)
    end

    @session.update!(
      hiring_decision: decision,
      decision_notes: notes,
      decided_at: (
        decision == "under_review" ?
          nil :
          Time.current
      )
    )
  end

  json_response(
    session: session_json(@session.reload),
    message: "Hiring decision updated successfully"
  )
rescue ActiveRecord::RecordInvalid => e
  json_error(
    e.record.errors.full_messages.first.presence ||
      "Unable to update hiring decision",
    :unprocessable_entity
  )
end

      private

      def set_session
        @session = Session.find(
          params[:id]
        )
      rescue ActiveRecord::RecordNotFound
        json_error(
          "Session not found",
          :not_found
        )
      end

      def dispatch_invitation_email(session)
        return if session.candidate_email.blank?

        InvitationDeliveryWorker.perform_async(
          session.id
        )
      rescue StandardError => e
        Rails.logger.error(
          "[SessionsController] Failed to enqueue invitation email " \
          "for session #{session.id}: #{e.class}: #{e.message}"
        )
      end

      def schedule_invitation_reminder(session)
        Sessions::ReminderScheduler.call(session)
      rescue StandardError => e
        Rails.logger.error(
          "[SessionsController] Failed to schedule reminder " \
          "for session #{session.id}: #{e.class}: #{e.message}"
        )
      end

      def session_json(session)
        {
          id: session.id,
          assessment_id: session.assessment_id,
          tenant_id: session.tenant_id,
          candidate_id: session.candidate_id,
          candidate_name: session.candidate_name,
          candidate_email: session.candidate_email,
          invite_token: session.invite_token,
          invite_url: session.invite_url,
          status: session.status,
          end_reason: session.end_reason,
          started_at: session.started_at,
          ended_at: session.ended_at,
          duration_seconds: session.duration_seconds,
          created_at: session.created_at,
          expires_at: session.expires_at,
          invitation_email_sent_at: session.invitation_email_sent_at,
          reminder_sent_at: session.reminder_sent_at,
          invitation_expired: session.invitation_expired?,
          hiring_decision: session.hiring_decision,
decision_notes: session.decision_notes,
decided_at: session.decided_at,
        }
      end

      def coverage_map_json(map)
        {
          id: map.id,
          skill_id: map.skill_id,
          skill_label: map.skill_label,
          is_discovered: map.is_discovered,
          state: map.state,
          probe_count: map.probe_count,
          last_signal: map.last_signal,
          updated_at: map.updated_at
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
    end
  end
end