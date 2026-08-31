# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!

      # POST /api/v1/auth/login
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        return json_error('Invalid email or password', :unauthorized) unless user&.authenticate(params[:password])

        return json_error('Invalid email or password', :unauthorized) unless user.role.in?(%w[admin user assessor])

        scheme = resolve_scheme
        token  = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

        json_response({ token:, user: { id: user.id, email: user.email, role: user.role } })
      end

      # POST /api/v1/signup
      def signup
        user = User.new(user_params)

        if user.save
          scheme = resolve_scheme
          token  = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

          json_response(
            { token:, user: { id: user.id, email: user.email, role: user.role } },
            :created
          )
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

      def user_params
        params.permit(:email, :password, :role)
      end
    end
  end
end
