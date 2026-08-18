# frozen_string_literal: true

module Api
  module V1
    class CvScreeningEntriesController < ApiController
      authorize_auth_token! :assessor

      before_action :set_cv_screening, only: %i[index]
      before_action :set_entry, only: %i[review file]

      # GET /api/v1/cv_screenings/:cv_screening_id/entries?sort=created_at&decision=needs_review
      def index
        scope = @cv_screening.cv_screening_entries
        scope = scope.where(decision: params[:decision]) if params[:decision].present?
        scope = scope.order(created_at: :desc)

        entries = paginate(scope)

        json_response(
          entries: entries.map(&method(:entry_json)),
          meta:    pagination_meta(entries)
        )
      end

      # POST /api/v1/cv_screening_entries/:id/review  {action: 'invite'|'reject'}
      def review
        case request_body[:action]
        when 'invite'
          # No detected_email is fine — Session#candidate_name / SessionRow already
          # render a nameless auto-invited session safely (see Phase 8 in the plan
          # doc), so a recruiter can still manually invite without one.
          CvScreenings::Inviter.new(entry: @entry).call
          @entry.update!(decision: 'invited', decision_reason: 'recruiter_invited')
          # A single recruiter action bypasses FR5's batch confirm gate — they just
          # explicitly decided this one outcome, so send immediately.
          CvScreenings::BatchNotifier.send_now!(@entry)
        when 'reject'
          feedback = CvScreenings::FeedbackGenerator.new(
            public_requirement_text: @entry.cv_screening_batch.vacancy_version&.public_requirement_text ||
                                      @entry.cv_screening_batch.vacancy.public_requirement_text
          ).call
          @entry.update!(decision: 'not_advanced', decision_reason: 'recruiter_rejected', feedback_text: feedback)
          CvScreenings::BatchNotifier.send_now!(@entry)
        else
          return json_error("action must be 'invite' or 'reject'", :unprocessable_entity)
        end

        json_response(entry: entry_json(@entry))
      end

      # GET /api/v1/cv_screening_entries/:id/file
      def file
        return json_error('No file attached', :not_found) unless @entry.cv_file.attached?

        send_data @entry.cv_file.download,
                  filename:    @entry.cv_file.filename.to_s,
                  type:        @entry.cv_file.content_type,
                  disposition: 'attachment'
      end

      private

      def set_cv_screening
        @cv_screening = CvScreening.find(params[:cv_screening_id])
      rescue ActiveRecord::RecordNotFound
        json_error('CV screening not found', :not_found)
      end

      def set_entry
        @entry = CvScreeningEntry.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error('CV screening entry not found', :not_found)
      end

      def entry_json(entry)
        {
          id:                     entry.id,
          cv_screening_batch_id:  entry.cv_screening_batch_id,
          detected_email:         entry.detected_email,
          decision:               entry.decision,
          decision_reason:        entry.decision_reason,
          filename:               entry.cv_file.attached? ? entry.cv_file.filename.to_s : nil,
          created_at:             entry.created_at
        }
      end

      def pagination_meta(collection)
        {
          current_page: collection.current_page,
          total_pages:  collection.total_pages,
          total_count:  collection.total_count,
          per_page:     collection.limit_value
        }
      end
    end
  end
end
