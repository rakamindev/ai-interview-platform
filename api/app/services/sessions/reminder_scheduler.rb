# frozen_string_literal: true

module Sessions
  class ReminderScheduler
    def self.call(session)
      return unless session.pending?
      return if session.candidate_email.blank?
      return if session.expires_at.blank?
      return if session.reminder_sent_at.present?

      remaining = session.expires_at - Time.current

      reminder_offset =
        if remaining > 24.hours
          24.hours
        elsif remaining > 12.hours
          12.hours
        elsif remaining > 2.hours
          1.hour
        end

      return unless reminder_offset

      reminder_at = session.expires_at - reminder_offset

      return if reminder_at <= Time.current

      expected_expires_at = session.expires_at
        .utc
        .iso8601(6)

      InvitationReminderWorker.perform_at(
        reminder_at,
        session.id,
        expected_expires_at
      )

      Rails.logger.info(
        "[ReminderScheduler] Reminder scheduled " \
        "for session #{session.id} at #{reminder_at}"
      )
    end
  end
end