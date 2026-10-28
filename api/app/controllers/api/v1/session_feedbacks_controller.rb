# frozen_string_literal: true

module Api
  module V1
    class SessionFeedbacksController < ApiController
      authorize_auth_token! :assessor, only: %i[show]
      skip_before_action :require_tenant!, only: %i[create]

      # POST /api/v1/sessions/:token/feedback
      # Candidate submits feedback without JWT using invite token
      def create
        session = Session.unscoped.find_by(invite_token: params[:token])
        unless session
          return json_error("Invalid or expired session token", :not_found)
        end

        if session.session_feedback.present?
          return json_error("Feedback has already been submitted for this session", :unprocessable_entity)
        end

        feedback = SessionFeedback.new(feedback_params)
        feedback.session = session
        feedback.tenant_id = session.tenant_id
        feedback.submitted_at = Time.current

        if feedback.save
          json_response({ feedback: feedback_json(feedback) }, :created)
        else
          json_error(feedback.errors.full_messages.first, :unprocessable_entity)
        end
      rescue ActiveRecord::RecordNotUnique
        json_error("Feedback has already been submitted for this session", :unprocessable_entity)
      end

      # GET /api/v1/sessions/:id/feedback
      # Admin/assessor views feedback for a session
      def show
        session = Session.find(params[:id])
        feedback = session.session_feedback

        json_response({ feedback: feedback ? feedback_json(feedback) : nil })
      rescue ActiveRecord::RecordNotFound
        json_error("Session not found", :not_found)
      end

      private

      def feedback_params
        params.require(:feedback).permit(
          :rating,
          :experience_tag,
          :feedback_text,
          :has_complaint,
          :complaint_text
        )
      end

      def feedback_json(fb)
        {
          id:             fb.id,
          session_id:     fb.session_id,
          rating:         fb.rating,
          experience_tag: fb.experience_tag,
          feedback_text:  fb.feedback_text,
          has_complaint:  fb.has_complaint,
          complaint_text: fb.complaint_text,
          submitted_at:   fb.submitted_at || fb.created_at
        }
      end
    end
  end
end
