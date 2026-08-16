# frozen_string_literal: true

module Api
  module V1
    # Admin-only user management. Registration is invite-based (admin creates
    # accounts) — there is no public signup endpoint.
    class UsersController < ApiController
      authorize_auth_token! :admin

      # GET /api/v1/users
      def index
        users = User.order(:email)

        json_response(users: users.map(&method(:user_json)))
      end

      # POST /api/v1/users
      def create
        user = User.new(user_params)

        if user.save
          json_response({ user: user_json(user), message: 'User created' }, :created)
        else
          json_error(user.errors.full_messages.first, :unprocessable_entity)
        end
      end

      private

      def user_params
        params.require(:user).permit(:email, :password, :role)
      end

      def user_json(user)
        {
          id:         user.id,
          email:      user.email,
          role:       user.role,
          created_at: user.created_at
        }
      end
    end
  end
end
