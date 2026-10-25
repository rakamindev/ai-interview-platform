# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!

      # POST /api/v1/auth/login
      #
      # F-03 phase 2 (decision evolution A → D): tenancy is derived from the
      # account's organization relation — the login is clean (email + password),
      # and any X-Tenant-Scheme header is ignored (a user can never claim a
      # tenant that is not their own via input). A user without an assigned
      # organization is rejected explicitly instead of being silently routed.
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        return json_error('Invalid email or password', :unauthorized) unless user&.authenticate(params[:password])

        return json_error('Invalid email or password', :unauthorized) unless user.role == 'admin'

        organization = user.organization
        return json_error('Account is not assigned to an organization', :unauthorized) if organization.nil?

        token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: organization.scheme })

        json_response({ token:, user: { id: user.id, email: user.email, role: user.role } })
      end

      # POST /api/v1/auth/signup
      #
      # Administrator signup is authorized only by a server-issued invitation.
      # The invitation owns both tenant and recipient email. Client-supplied
      # organization_id, tenant_id, and role values are deliberately ignored.
      def signup
        user, organization = AdministratorInvitations::Redeemer.call(
          token: params[:invitation_token],
          email: params[:email],
          password: params[:password]
        )

        token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: organization.scheme })
        json_response({ token:, user: { id: user.id, email: user.email, role: user.role } }, :created)
      rescue AdministratorInvitations::Redeemer::InvalidInvitation
        render json: ErrorEnvelope.payload(
          message: 'Invitation is invalid or no longer available',
          status: :unprocessable_entity,
          code: 'invalid_invitation'
        ), status: :unprocessable_entity
      rescue ActiveRecord::RecordInvalid => e
        json_error(e.record.errors.full_messages.first, :unprocessable_entity)
      end
    end
  end
end
