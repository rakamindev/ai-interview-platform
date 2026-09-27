# frozen_string_literal: true

module Api
  module V1
    module Admin
      # Allows platform Super Admins to provision other Super Admins
      # and Tenant Admins (Assessors) bound to organizations.
      class UsersController < ApiController
        skip_before_action :require_tenant!
        authorize_auth_token! :admin

        # GET /api/v1/admin/users
        def index
          users = User.includes(:organization).order(created_at: :desc)
          users = users.where(role: params[:role]) if params[:role].present?
          users = users.where(organization_id: params[:organization_id]) if params[:organization_id].present?

          json_response({ users: users.map { |u| serialize_user(u) } })
        end

        # POST /api/v1/admin/users
        def create
          user_params = params.require(:user).permit(:email, :password, :password_confirmation, :role, :organization_id)
          role = user_params[:role].to_s

          unless role.in?(%w[admin assessor])
            return json_error("Role must be either 'admin' or 'assessor'", :unprocessable_entity)
          end

          if role == 'assessor'
            org_id = user_params[:organization_id]
            if org_id.blank?
              return json_error('Organization is required for assessors', :unprocessable_entity)
            end

            org = Organization.find_by(id: org_id)
            unless org
              return json_error('Organization not found', :unprocessable_entity)
            end
          end

          user = User.new(user_params)
          if user.save
            json_response({ user: serialize_user(user) }, :created)
          else
            json_error(user.errors.full_messages.join(', '), :unprocessable_entity)
          end
        end

        private

        def serialize_user(user)
          {
            id: user.id,
            email: user.email,
            role: user.role,
            organization_id: user.organization_id,
            organization_name: user.organization&.name,
            organization_scheme: user.organization&.scheme,
            created_at: user.created_at
          }
        end
      end
    end
  end
end
