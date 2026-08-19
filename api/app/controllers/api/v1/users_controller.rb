# frozen_string_literal: true

module Api
  module V1
    class UsersController < ApiController
      authorize_auth_token! :admin

      # GET /api/v1/users
      def index
        users = User.order(created_at: :desc)
        json_response(
          users: users.map do |u|
            {
              id:         u.id,
              email:      u.email,
              role:       u.role,
              created_at: u.created_at,
              updated_at: u.updated_at
            }
          end
        )
      end

      # POST /api/v1/users
      def create
        email    = params[:email].to_s.downcase.strip
        password = params[:password].to_s
        role     = params[:role].to_s.strip

        unless User::ROLES.include?(role)
          return json_error("Invalid role. Allowed: #{User::ROLES.join(', ')}", :unprocessable_entity)
        end

        if User.exists?(email: email)
          return json_error('Email has already been taken', :unprocessable_entity)
        end

        user = User.new(email: email, password: password, role: role)

        if user.save
          json_response(
            {
              user: {
                id:         user.id,
                email:      user.email,
                role:       user.role,
                created_at: user.created_at
              }
            },
            :created
          )
        else
          json_error(user.errors.full_messages.first, :unprocessable_entity)
        end
      end

      # PUT /api/v1/users/:id
      def update
        user = User.find(params[:id])
        role = params[:role].to_s.strip

        if role.present?
          unless User::ROLES.include?(role)
            return json_error("Invalid role. Allowed: #{User::ROLES.join(', ')}", :unprocessable_entity)
          end
          user.role = role
        end

        if params[:password].present?
          user.password = params[:password]
        end

        if user.save
          json_response(
            user: {
              id:         user.id,
              email:      user.email,
              role:       user.role,
              updated_at: user.updated_at
            }
          )
        else
          json_error(user.errors.full_messages.first, :unprocessable_entity)
        end
      rescue ActiveRecord::RecordNotFound
        json_error('User not found', :not_found)
      end

      # DELETE /api/v1/users/:id
      def destroy
        user = User.find(params[:id])

        if user.id == current_user.id
          return json_error('Cannot delete your own admin account', :unprocessable_entity)
        end

        user.destroy
        json_response(message: 'User removed')
      rescue ActiveRecord::RecordNotFound
        json_error('User not found', :not_found)
      end
    end
  end
end
