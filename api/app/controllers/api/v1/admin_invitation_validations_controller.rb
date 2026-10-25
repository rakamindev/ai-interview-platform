# frozen_string_literal: true

module Api
  module V1
    class AdminInvitationValidationsController < ApiController
      skip_before_action :require_tenant!

      def create
        invitation = find_active_invitation(params[:invitation_token])
        return invalid_invitation unless invitation

        json_response(
          {
            invitation: {
              recipient_email: invitation.recipient_email,
              expires_at: invitation.expires_at,
              organization: { name: invitation.organization.name }
            }
          }
        )
      end

      private

      def find_active_invitation(raw_token)
        return if raw_token.blank?

        AdministratorInvitation
          .includes(:organization)
          .find_by(token_digest: AdministratorInvitation.digest_token(raw_token))
          .then { |invitation| invitation if invitation&.active? }
      end

      def invalid_invitation
        render json: ErrorEnvelope.payload(
          message: 'Invitation is invalid or no longer available',
          status: :unprocessable_entity,
          code: 'invalid_invitation'
        ), status: :unprocessable_entity
      end
    end
  end
end
