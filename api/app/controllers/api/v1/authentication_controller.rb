# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!

      # Roles that may obtain a JWT.
      #   admin — assessor superuser: full access to every assessor endpoint.
      #   user  — candidate account: may sign in, but every assessor endpoint
      #           stays restricted to admin/assessor via
      #           AuthorizeApiRequest::ASSESSOR_ROLES (authorization is NOT
      #           widened here — this only authenticates).
      LOGIN_ROLES = %w[admin user assessor candidate student].freeze

      # POST /api/v1/auth/login
      def authenticate
        email = params[:email].to_s.strip.downcase
        user  = User.find_by(email:)

        authenticated = user&.authenticate(params[:password])
        if !authenticated && Rails.env.development? && user
          if %w[password123 123].include?(params[:password]) &&
             (user.authenticate('password123') || user.authenticate('123'))
            authenticated = true
          end
        end

        return json_error('Invalid email or password', :unauthorized) unless authenticated

        return json_error('Invalid email or password', :unauthorized) unless LOGIN_ROLES.include?(user.role)

        scheme = resolve_scheme
        token  = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

        json_response({ token:, user: { id: user.id, email: user.email, role: user.role } })
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
