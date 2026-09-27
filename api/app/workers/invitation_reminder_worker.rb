
# frozen_string_literal: true

class InvitationReminderWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 5

  def perform(session_id, expected_expires_at)
    session = Session.unscoped.find_by(id: session_id)

    return unless session

    session.with_lock do
      return unless reminder_eligible?(
        session,
        expected_expires_at
      )

      InvitationReminderMailer
        .reminder(session.id)
        .deliver_now

      session.update!(
        reminder_sent_at: Time.current
      )

      Rails.logger.info(
        "[InvitationReminderWorker] Reminder sent for session #{session.id}"
      )
    end
  end

  private

  def reminder_eligible?(session, expected_expires_at)
    return false unless session.pending?
    return false if session.candidate_email.blank?
    return false if session.expires_at.blank?
    return false if session.reminder_sent_at.present?
    return false if session.expires_at <= Time.current

    current_expiration = session.expires_at
      .utc
      .iso8601(6)

    return false unless current_expiration == expected_expires_at

    true
  end
end
