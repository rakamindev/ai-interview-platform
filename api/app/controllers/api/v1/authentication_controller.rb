# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!
      authorize_auth_token! :any, only: %i[me]

      # POST /api/v1/auth/login
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        return json_error('Invalid email or password', :unauthorized) unless user&.authenticate(params[:password])

        return json_error('Invalid email or password', :unauthorized) unless user.role == 'admin'

        scheme = resolve_scheme
        token  = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

        json_response({ token:, user: { id: user.id, email: user.email, role: user.role } })
      end

      # POST /api/v1/signup
      def signup
        user = User.new(email: params[:email].to_s, password: params[:password], role: params[:role])

        if user.save
          scheme = resolve_scheme
          token  = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

          json_response({ token:, user: { id: user.id, email: user.email, role: user.role } }, :created)
        else
          json_error('Signup failed', :unprocessable_entity, details: user.errors.messages)
        end
      end

      # GET /api/v1/me — current assessor identity for the shell header.
      def me
        user = User.find_by(id: Current.user&.id)

        if user
          json_response(user: { id: user.id, email: user.email, role: user.role })
        else
          json_response(user: { id: Current.user&.id, role: Current.user&.role })
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
