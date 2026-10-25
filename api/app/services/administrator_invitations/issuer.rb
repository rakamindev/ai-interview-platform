# frozen_string_literal: true

require 'securerandom'

module AdministratorInvitations
  class Issuer
    EXPIRY_WINDOW = 24.hours
    TOKEN_BYTES = 32

    def self.call(inviter:, email:)
      raw_token = SecureRandom.urlsafe_base64(TOKEN_BYTES)
      invitation = AdministratorInvitation.create!(
        organization: inviter.organization,
        inviter:,
        recipient_email: email,
        token_digest: AdministratorInvitation.digest_token(raw_token),
        expires_at: EXPIRY_WINDOW.from_now
      )

      [invitation, raw_token]
    end
  end
end
