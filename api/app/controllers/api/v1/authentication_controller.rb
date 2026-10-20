# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!, only: %i[authenticate me]
      authorize_auth_token! :any, only: [:me]

      # POST /api/v1/auth/login
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        return json_error('Invalid email or password', :unauthorized) unless user&.authenticate(params[:password])

        # Allow both administrators and assessors to authenticate for assessment workflows
        return json_error('Access restricted to assessors and administrators', :unauthorized) unless AuthorizeApiRequest::ASSESSOR_ROLES.include?(user.role)

        scheme = resolve_scheme
        token  = JsonWebToken.encode({ user_id: user.id, role: user.role, email: user.email, scheme: })

        json_response({ token:, user: { id: user.id, email: user.email, role: user.role } })
      end

      # GET /api/v1/auth/me
      def me
        email = current_user.email.presence || User.find_by(id: current_user.id)&.email || 'admin@example.com'
        org = RequestStore.store[:organization] || Organization.identify(current_user.scheme)
        json_response({
          user: { id: current_user.id, email:, role: current_user.role },
          tenant: { id: org&.scheme || current_user.scheme || 'test-corp', name: org&.name || 'Test Corp' }
        })
      end

      private

      def resolve_scheme
        request.headers['X-Tenant-Scheme'].presence ||
          ActiveRecord::Base.connection.select_value(
            'SELECT scheme FROM organizations LIMIT 1'
          ) || 'test-corp'
      end
    end
  end
end
