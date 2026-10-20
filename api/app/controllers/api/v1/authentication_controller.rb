# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!

      # POST /api/v1/auth/login
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        return json_error('Invalid email or password', :unauthorized) unless user&.authenticate(params[:password])

        return json_error('Invalid email or password', :unauthorized) unless user.role == 'admin'

        scheme = resolve_scheme
        # Same answer as a wrong password: a refused company says nothing about which companies exist.
        return json_error('Invalid email or password', :unauthorized) unless scheme

        token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

        json_response({ token:, user: { id: user.id, email: user.email, role: user.role } })
      end

      private

      # Users don't belong to a company yet (C2), so the request can't be trusted to name one. Where the server
      # sets the company (LOGIN_TENANT_SCHEME, required in production), the header may only repeat it.
      # Without it (development, tests), the header or the first organization is used, as before.
      def resolve_scheme
        requested  = request.headers['X-Tenant-Scheme'].presence
        server_set = ENV['LOGIN_TENANT_SCHEME'].presence
        return (requested.nil? || requested == server_set ? server_set : nil) if server_set

        requested ||
          ActiveRecord::Base.connection.select_value(
            'SELECT scheme FROM organizations LIMIT 1'
          ) || 'test-corp'
      end
    end
  end
end
