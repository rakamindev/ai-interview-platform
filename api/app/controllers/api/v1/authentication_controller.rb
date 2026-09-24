# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!

      # POST /api/v1/auth/login
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        return json_error('Invalid email or password', :unauthorized) unless user&.authenticate(params[:password])

        scheme = request.headers['X-Tenant-Scheme'].presence
        memberships = user.tenant_memberships.active.includes(:organization)
        membership = scheme ? memberships.find { |item| item.organization.scheme == scheme } : memberships.one? ? memberships.first : nil
        return json_error('Tenant membership is required', :forbidden) unless membership
        return json_error('Invalid email or password', :unauthorized) unless AuthorizeApiRequest::ASSESSOR_ROLES.include?(membership.role)

        token = JsonWebToken.encode(user_id: user.id, scheme: membership.organization.scheme)
        json_response({ token:, user: { id: user.id, email: user.email, role: membership.role } })
      end

      private

    end
  end
end
