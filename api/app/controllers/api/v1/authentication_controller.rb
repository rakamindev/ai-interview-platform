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
        token  = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

        json_response({ token:, user: { id: user.id, email: user.email, role: user.role } })
      end

      private

      def resolve_scheme
        # Stop trusting X-Tenant-Scheme at login — the header is client-controlled
        # and lets any admin mint a token for an arbitrary organisation (P0-1).
        # Use the referer host to resolve the scheme, falling back to the first org.
        scheme_from_referer ||
          ActiveRecord::Base.connection.select_value(
            'SELECT scheme FROM organizations LIMIT 1'
          ) || 'test-corp'
      end

      def scheme_from_referer
        referer = request.referer.to_s
        return if referer.blank?

        host = URI.parse(referer).host.to_s
        return if host.blank?

        Organization.find_by(host: host)&.scheme
      rescue URI::InvalidURIError
        nil
      end
    end
  end
end
