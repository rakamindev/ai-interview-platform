# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!

      # POST /api/v1/auth/login
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        return json_error('Invalid email or password', :unauthorized) unless user&.authenticate(params[:password])

        return json_error('Invalid email or password', :unauthorized) unless %w[admin assessor user].include?(user.role)

        # In development, auto-rehash legacy cost-12 digests to MIN_COST (cost 4) for instant subsequent logins
        if Rails.env.development? && user.password_digest.match?(/\A\$2[aby]\$(?:1[0-9]|20)\$/)
          user.update_column(:password_digest, BCrypt::Password.create(params[:password], cost: BCrypt::Engine::MIN_COST))
        end

        scheme = resolve_scheme
        token  = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

        json_response({ token:, user: { id: user.id, email: user.email, role: user.role } })
      end

      # POST /api/v1/auth/signup
      def signup
        role = params[:role].presence || 'user'
        user = User.new(
          email: params[:email].to_s.strip,
          password: params[:password],
          role: role
        )

        if user.save
          scheme = resolve_scheme
          token  = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

          json_response({ token:, user: { id: user.id, email: user.email, role: user.role } }, :created)
        else
          json_error(user.errors.full_messages.join(', '), :unprocessable_entity)
        end
      end

      private

      def resolve_scheme
        request.headers['X-Tenant-Scheme'].presence ||
          Rails.cache.fetch('default_tenant_scheme', expires_in: 1.hour) do
            ActiveRecord::Base.connection.select_value('SELECT scheme FROM organizations LIMIT 1')
          end || 'test-corp'
      end
    end
  end
end
