# frozen_string_literal: true

module CvScreenings
  # FR5's confirm-before-firing gate: if every auto-decided entry in a batch lands
  # on the SAME outcome (everyone invited, or everyone rejected), that's a strong
  # signal something is misconfigured (a broken threshold, an overly narrow public
  # gate) — the batch holds its notification emails for explicit recruiter
  # confirmation instead of firing them immediately. A batch with a normal mix of
  # outcomes releases its emails as soon as it finishes processing.
  #
  # Manual, single-entry recruiter review (CvScreeningEntriesController#review)
  # bypasses this gate entirely and always sends immediately via .send_now! — a
  # human just explicitly decided that one outcome directly, so the "did the
  # automated pipeline go systematically wrong" risk this gate exists for doesn't
  # apply.
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
    # holds or releases exactly once.
    def evaluate_after_entry_decision
      return if @batch.cv_screening_entries.where(decision: 'pending').exists?
      return unless @batch.notification_status == 'pending'

      uniform_outcome? ? @batch.update!(notification_status: 'held') : release!
    end

    # Sends every queued (not yet notified) invite/reject email for this batch.
    # Called automatically for a mixed-outcome batch, or explicitly by a recruiter
    # confirming a held one.
    def release!
      @batch.cv_screening_entries
            .where(decision: %w[invited not_advanced], notified_at: nil)
            .find_each { |entry| self.class.send_now!(entry) }

      @batch.update!(notification_status: 'released')
    end

    private

    def uniform_outcome?
      decided_outcomes = @batch.cv_screening_entries.where(decision: %w[invited not_advanced]).distinct.pluck(:decision)
      decided_outcomes.size == 1
    end
  end
end
