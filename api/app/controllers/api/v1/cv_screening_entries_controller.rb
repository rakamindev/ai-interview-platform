# frozen_string_literal: true

module Api
  module V1
    class CvScreeningEntriesController < ApiController
      authorize_auth_token! :assessor

      before_action :set_cv_screening, only: %i[index]
      before_action :set_entry, only: %i[review reanalyze cancel file]

      REANALYZABLE_REASONS = %w[model_failed cancelled].freeze

      # GET /api/v1/cv_screenings/:cv_screening_id/entries?sort=created_at&decision=needs_review
      def index
        # A screening's vacancy/assessment can change after batches already exist
        # (CvScreeningEditPage) — each entry's actual vacancy/assessment is
        # whatever its own batch snapshotted, so entry_json below reads through
        # that, not the (possibly since-changed) live @cv_screening. Eager-loaded
        # here to avoid an N+1 across the whole page of entries.
        scope = @cv_screening.cv_screening_entries.includes(cv_screening_batch: %i[vacancy assessment])
        scope = scope.where(decision: params[:decision]) if params[:decision].present?
        scope = scope.order(created_at: :desc)

        entries = paginate(scope)

        json_response(
          entries: entries.map(&method(:entry_json)),
          meta:    pagination_meta(entries)
        )
      end

      # POST /api/v1/cv_screening_entries/:id/review  {action: 'invite'|'reject', email?: string}
      def review
        action = request_body[:action]
        return json_error("action must be 'invite' or 'reject'", :unprocessable_entity) unless %w[invite reject].include?(action)

        # An entry with no detected email has no address for Inviter/CvScreeningMailer
        # to send to — Inviter sets candidate_name: @entry.detected_email, and
        # CvScreeningMailer mails to: entry.detected_email, so a nil here means the
        # notification silently fails (BatchNotifier.send_now! only logs the error).
        # Require and persist one before proceeding, but only when the entry doesn't
        # already have one — an entry with a detected email keeps working exactly as
        # before, and this param is ignored for it.
        if @entry.detected_email.blank?
          email = request_body[:email].presence
          return json_error(
            'An email address is required to invite or reject a candidate with no detected email.',
            :unprocessable_entity
          ) if email.nil?
          return json_error('Enter a valid email address.', :unprocessable_entity) unless email.match?(URI::MailTo::EMAIL_REGEXP)

          @entry.update!(detected_email: email)
        end

        case action
        when 'invite'
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
        end

        json_response(entry: entry_json(@entry))
      end

      # POST /api/v1/cv_screening_entries/:id/reanalyze
      #
      # Only for entries that failed because the pipeline itself broke (a Gemini
      # call errored, timed out, or returned something unusable) or were manually
      # cancelled out of a stuck 'pending' state (see #cancel below) — never for a
      # real outcome the pipeline actually reached (below_private_threshold,
      # no_email_detected, etc.), since re-running those wouldn't produce a
      # different answer. Resets the entry back to 'pending' and re-enqueues the
      # same worker Phase 6 already built — no separate retry logic, just makes
      # the entry eligible again for the existing idempotency guard
      # (CvScreeningProcessEntryWorker#perform returns unless entry.pending?).
      def reanalyze
        unless @entry.decision == 'needs_review' && REANALYZABLE_REASONS.include?(@entry.decision_reason)
          return json_error('Only an entry that failed to analyze can be re-analyzed', :unprocessable_entity)
        end

        @entry.update!(decision: 'pending', decision_reason: nil, score: nil)
        CvScreeningProcessEntryWorker.perform_async(@entry.id)

        json_response(entry: entry_json(@entry))
      end

      # POST /api/v1/cv_screening_entries/:id/cancel
      #
      # For an entry stuck in 'pending' — the worker never got to it (e.g. a
      # Sidekiq outage), or is taking far longer than a recruiter is willing to
      # wait. Moves it to 'needs_review' rather than any kind of rejection — a
      # candidate whose analysis never ran has had no real evaluation at all, so
      # this must never look like an automated decision (same invariant the
      # pipeline itself follows for every other failure path). Also re-evaluates
      # the batch's notification gate: BatchNotifier.evaluate_after_entry_decision
      # only runs once a batch has ZERO entries left 'pending' — a permanently
      # stuck entry would otherwise silently block every other already-decided
      # entry in the same batch from ever being notified at all.
      def cancel
        return json_error('Only a still-processing entry can be cancelled', :unprocessable_entity) unless @entry.pending?

        @entry.update!(decision: 'needs_review', decision_reason: 'cancelled')
        CvScreenings::BatchNotifier.new(@entry.cv_screening_batch).evaluate_after_entry_decision

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
          score:                  entry.score,
          filename:               entry.cv_file.attached? ? entry.cv_file.filename.to_s : nil,
          created_at:             entry.created_at,
          # The batch's own snapshotted vacancy/assessment/threshold — not the
          # screening's current ones, which may have changed since this entry was
          # decided.
          vacancy_role_title:     entry.cv_screening_batch.vacancy.role_title,
          assessment_name:        entry.cv_screening_batch.assessment.name,
          threshold:              entry.cv_screening_batch.threshold
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
