# frozen_string_literal: true

module Api
  module V1
    # Admin-invite flow (WEB-NEW-01): an existing admin generates a scoped,
    # expiring invite for a new admin/assessor account in their organization.
    # Stateless — the invite is a short-lived signed JWT (purpose: "invite"),
    # not a persisted row, mirroring the sibling candidate invite-token model
    # closely enough to reuse without a new table.
    class InvitesController < ApiController
      include TokenIssuance

      INVITE_EXPIRY = 3.days
      INVITE_ROLES = %w[admin assessor].freeze

      authorize_auth_token! :admin, only: :create
      skip_before_action :require_tenant!, only: :accept

      # POST /api/v1/auth/invites
      # Body: { invite: { email:, role: } }
      def create
        email = invite_params[:email].to_s.downcase
        role  = invite_params[:role].to_s

        return json_error("email is required", :unprocessable_entity) if email.blank?
        return json_error("role must be one of #{INVITE_ROLES.join(', ')}", :unprocessable_entity) unless INVITE_ROLES.include?(role)

        token = JsonWebToken.encode(
          {
            purpose: "invite",
            email: email,
            role: role,
            organization_id: Current.organization.id,
            scheme: Current.organization.scheme
          },
          INVITE_EXPIRY
        )

        invite_url = "#{ENV.fetch('WEB_BASE_URL', 'http://localhost:5173')}/accept-invite?token=#{token}"
        json_response({ invite_url: invite_url })
      end

      # POST /api/v1/auth/accept_invite
      # Body: { token:, password: }
      def accept
        claims = JsonWebToken.decode(params[:token].to_s)
        return json_error("Invalid invite", :unauthorized, code: "invite_invalid") unless claims[:purpose] == "invite"

        organization = Organization.find_by(id: claims[:organization_id])
        return json_error("Invite organization no longer exists", :unprocessable_entity, code: "invite_org_missing") unless organization

        user = User.find_by(email: claims[:email])
        if user
          # Existing account — grant membership only, don't touch their credentials.
          Membership.find_or_create_by!(user: user, organization: organization) { |m| m.role = claims[:role] }
        else
          return json_error("password is required", :unprocessable_entity, code: "password_required") if params[:password].blank?

          user = User.create!(email: claims[:email], role: "user", password: params[:password])
          Membership.create!(user: user, organization: organization, role: claims[:role])
        end

        json_response(issue_session_for(user, scheme: organization.scheme))
      rescue ExceptionHandler::InvalidToken
        json_error("Invite is invalid or has expired", :unauthorized, code: "invite_expired")
      end

      private

      def invite_params
        params.require(:invite).permit(:email, :role)
      rescue ActionController::ParameterMissing
        {}
      end
    end
  end
end
