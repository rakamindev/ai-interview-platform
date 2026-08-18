# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!
      authorize_auth_token! :any, except: %i[authenticate]

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

      # POST /api/v1/auth/change_password — any authenticated user.
      # Admins hand out temporary passwords; users must be able to change
      # their own, verified against the current one.
      def change_password
        user = User.find_by(id: current_user.id)
        return json_error('Account not found', :not_found) unless user
        return json_error('Current password is incorrect', :unprocessable_entity) unless user.authenticate(params[:current_password])
        return json_error('New password is required', :unprocessable_entity) if params[:password].blank?

        if user.update(password: params[:password])
          json_response(message: 'Password updated')
        else
          json_error(user.errors.full_messages.first, :unprocessable_entity)
        end
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
