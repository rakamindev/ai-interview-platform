# frozen_string_literal: true

module Api
  module V1
    class UsersController < ApiController
      skip_before_action :require_tenant!, only: [:create] # Skip for signup

      # POST /api/v1/signup
      def create
        user = User.new(user_params)
        user.role ||= 'user' # Default role to 'user' if not provided

        if user.save
          token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: user.organization.scheme }) # Ensure scheme is included
          json_response({ token: token, user: { id: user.id, email: user.email, role: user.role } }, :created)
        else
          json_error(user.errors.full_messages, :bad_request)
        end
      end

      private

      def user_params
        params.permit(:email, :password, :password_confirmation, :role)
      end
    end
  end
end
