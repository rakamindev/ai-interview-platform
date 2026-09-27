# frozen_string_literal: true

class InvitationDeliveryWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 5

  def perform(session_id)
    session = Session.unscoped.find_by(id: session_id)

    return unless session

    session.with_lock do
      return unless session.pending?
      return if session.candidate_email.blank?
      return if session.invitation_email_sent_at.present?
      return if session.invitation_expired?

      InvitationMailer
        .invitation(session.id)
        .deliver_now

      session.update!(
        invitation_email_sent_at: Time.current
      )

      Rails.logger.info(
        "[InvitationDeliveryWorker] Invitation sent for session #{session.id}"
      )
    end
  end
end