# frozen_string_literal: true

module CvScreenings
  # Releases a batch's notification emails as soon as it finishes processing —
  # no recruiter confirmation step. (FR5's original design held a batch for
  # explicit confirmation when every auto-decided entry landed on the same
  # outcome, as a signal something might be misconfigured — removed per request:
  # auto-invite/auto-reject should always fire immediately. The confirm
  # endpoint/action and `held_for_confirmation?` were removed along with it;
  # `held` stays in CvScreeningBatch::NOTIFICATION_STATUSES only so a
  # pre-existing 'held' row from before this change remains valid.)
  class BatchNotifier
    # Sends one entry's decision email right now, unconditionally. Used both by
    # #release! (below) and directly by the manual-review controller action.
    def self.send_now!(entry)
      case entry.decision
      when 'invited'      then CvScreeningMailer.invited(entry).deliver_now
      when 'not_advanced' then CvScreeningMailer.not_advanced(entry).deliver_now
      else return
      end
      entry.update!(notified_at: Time.current)
    rescue StandardError => e
      Rails.logger.error("[CvScreenings::BatchNotifier] failed to notify entry_id=#{entry.id}: #{e.class}")
    end

    def initialize(batch)
      @batch = batch
    end

    # Called after every automated (worker-driven) entry decision. No-ops until
    # the whole batch has finished processing (no entries left pending), then
    # releases exactly once.
    #
    # Also no-ops while every non-pending entry is still 'needs_review' (nothing
    # actually invited/rejected yet, e.g. a transient model/storage failure) —
    # a needs_review entry can later reach a real decision (Re-analyze), and
    # this method only acts while notification_status == 'pending', so releasing
    # too early here would permanently block that later decision from ever being
    # notified.
    def evaluate_after_entry_decision
      return if @batch.cv_screening_entries.where(decision: 'pending').exists?
      return unless @batch.notification_status == 'pending'
      return unless @batch.cv_screening_entries.where(decision: %w[invited not_advanced]).exists?

      release!
    end

    # Sends every queued (not yet notified) invite/reject email for this batch.
    # Called automatically once a batch finishes processing.
    def release!
      @batch.cv_screening_entries
            .where(decision: %w[invited not_advanced], notified_at: nil)
            .find_each { |entry| self.class.send_now!(entry) }

      @batch.update!(notification_status: 'released')
    end
  end
end
