# frozen_string_literal: true

module AdministratorInvitations
  class Redeemer
    class InvalidInvitation < StandardError; end

    def self.call(token:, email:, password:)
      normalized_email = AdministratorInvitation.normalize_email(email)
      digest = AdministratorInvitation.digest_token(token)

      AdministratorInvitation.transaction do
        invitation = AdministratorInvitation.lock.find_by(token_digest: digest)
        raise InvalidInvitation unless invitation&.active?
        raise InvalidInvitation unless invitation.recipient_email == normalized_email

        user = User.create!(
          email: normalized_email,
          password:,
          role: 'admin',
          organization: invitation.organization
        )
        invitation.update!(accepted_at: Time.current)

        [user, invitation.organization]
      end
    end
  end
end
