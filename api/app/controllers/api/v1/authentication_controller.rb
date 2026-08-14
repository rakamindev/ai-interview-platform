# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!

      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        return json_error('Invalid email or password', :unauthorized) unless user&.authenticate(params[:password])
        return json_error('Invalid email or password', :unauthorized) unless user.role == 'admin'

        scheme = user.organization&.scheme
        return json_error('Account is not linked to an organization', :forbidden) if scheme.blank?

        token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

        json_response({ token:, user: { id: user.id, email: user.email, role: user.role } })
      end
    end
  end
end
