# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!

      # POST /api/v1/auth/login
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        return json_error('Invalid email or password', :unauthorized) unless user&.authenticate(params[:password])

        # Only admin and assessor roles may use the platform (registration is
        # admin-only; public signup does not exist).
        return json_error('Invalid email or password', :unauthorized) unless User::ROLES.include?(user.role)

        scheme = resolve_scheme
        token  = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })
        org    = Organization.identify(scheme)

        json_response({
                        token:,
                        user:         { id: user.id, email: user.email, role: user.role },
                        organization: org ? { id: org.id, name: org.name, scheme: org.scheme } : nil
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
