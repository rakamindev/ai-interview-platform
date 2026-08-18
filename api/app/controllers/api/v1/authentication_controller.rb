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
        unless scheme
          return json_error('Tenant scheme could not be resolved. Send an X-Tenant-Scheme header to log in.', :unauthorized)
        end

        token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

        json_response({ token:, user: { id: user.id, email: user.email, role: user.role } })
      end

      private

      # Resolve the tenant scheme explicitly: header first, then referer host.
      # There is deliberately NO silent 'first organization' fallback — minting a
      # token against an arbitrary org on a multi-tenant install is how cross-tenant
      # data exposure starts. Fail closed instead and tell the caller what to send.
      def resolve_scheme
        request.headers['X-Tenant-Scheme'].presence ||
          scheme_from_referer
      end

      def scheme_from_referer
        referer = request.referer.to_s
        return if referer.blank?

        host = URI.parse(referer).host.to_s
        host.presence
      rescue URI::InvalidURIError
        nil
      end
    end
  end
end
