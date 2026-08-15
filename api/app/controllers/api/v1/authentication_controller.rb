# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!

      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        return json_error('Invalid email or password', :unauthorized) unless user&.authenticate(params[:password])
        return json_error('Invalid email or password', :unauthorized) unless AuthorizeApiRequest::ASSESSOR_ROLES.include?(user.role)

        scheme = user.organization&.scheme
        return json_error('Account is not linked to an organization', :forbidden) if scheme.blank?

        token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })
        set_auth_cookie(token)

        json_response({ token:, user: { id: user.id, email: user.email, role: user.role } })
      end

      def logout
        response.delete_cookie('auth_token', path: '/', same_site: :lax)
        json_response({ message: 'Logged out' })
      end

      private

      def set_auth_cookie(token)
        ttl = ENV['TOKEN_EXPIRATION_TIME'].presence&.to_i || 3.days.to_i

        response.set_cookie('auth_token', {
                              value:     token,
                              path:      '/',
                              httponly:  true,
                              secure:    Rails.env.production?,
                              same_site: :lax,
                              expires:   Time.current + ttl
                            })
      end
    end
  end
end
