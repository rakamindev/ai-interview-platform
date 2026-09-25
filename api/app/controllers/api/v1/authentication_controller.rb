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

        scheme = resolve_scheme(user)
        return json_error('Account has no organization assigned', :forbidden) unless scheme
        token  = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

        json_response({ token:, user: { id: user.id, email: user.email, role: user.role } })
      end

      private

      def resolve_scheme(user)
        user.with_lock do
          if user.organization_id.nil?
            organizations = Organization.limit(2).to_a
            return unless organizations.one?
            user.update!(organization_id: organizations.first.id)
          end
          Organization.find_by(id: user.organization_id)&.scheme
        end
      end
    end
  end
end
