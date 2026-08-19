# frozen_string_literal: true

module Api
  module V1
    class CvScreeningBatchesController < ApiController
      authorize_auth_token! :assessor

      before_action :set_cv_screening

      # GET /api/v1/cv_screenings/:cv_screening_id/batches
      # Not in the original design, but the frontend needs this on every page
      # load (not just right after an upload) to know whether the latest batch
      # is held awaiting confirmation, or scored against an approximate snapshot.
      def index
        batches = @cv_screening.cv_screening_batches.order(created_at: :desc)

        json_response(batches: batches.map(&method(:batch_json)))
      end

      # POST /api/v1/cv_screenings/:cv_screening_id/batches  (multipart)
      def create
        files = Array(params[:files]).reject(&:blank?)
        return json_error('At least one file is required', :unprocessable_entity) if files.blank?

        batch = @cv_screening.cv_screening_batches.create!(
          vacancy_id:         @cv_screening.vacancy_id,
          assessment_id:      @cv_screening.assessment_id,
          vacancy_version_id: current_vacancy_version&.id,
          threshold:          @cv_screening.threshold,
          created_by:         current_user.id
        )

        entries = files.map do |file|
          entry = batch.cv_screening_entries.create!
          entry.cv_file.attach(file)
          CvScreeningProcessEntryWorker.perform_async(entry.id)
          entry
        end

        json_response(
          {
            batch:   batch_json(batch),
            entries: entries.map(&method(:entry_json))
          },
          :created
        )
      rescue ActiveRecord::RecordInvalid => e
        json_error(e.message, :unprocessable_entity)
      end

      private

      def set_cv_screening
        @cv_screening = CvScreening.find(params[:cv_screening_id])
      rescue ActiveRecord::RecordNotFound
        json_error('CV screening not found', :not_found)
      end

      def current_vacancy_version
        @cv_screening.vacancy.vacancy_versions.order(created_at: :desc).first
      end

      def batch_json(batch)
        {
          id:                  batch.id,
          cv_screening_id:     batch.cv_screening_id,
          vacancy_id:          batch.vacancy_id,
          assessment_id:       batch.assessment_id,
          vacancy_version_id:  batch.vacancy_version_id,
          # Phase 2's backfill task can only reconstruct a version from a record's
          # CURRENT state, not its actual history — flagged so the UI can show that.
          vacancy_version_approximate: batch.vacancy_version&.approximate || false,
          threshold:           batch.threshold,
          notification_status: batch.notification_status,
          created_by:          batch.created_by,
          created_at:          batch.created_at
        }
      end

      def entry_json(entry)
        {
          id:               entry.id,
          cv_screening_batch_id: entry.cv_screening_batch_id,
          decision:         entry.decision,
          decision_reason:  entry.decision_reason,
          score:            entry.score,
          filename:         entry.cv_file.filename.to_s
        }
      end
    end
  end
end
