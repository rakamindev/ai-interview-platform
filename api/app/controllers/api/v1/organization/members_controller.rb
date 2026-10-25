# frozen_string_literal: true

module Api
  module V1
    module Organization
      class MembersController < ApiController
        authorize_auth_token! :assessor, only: %i[index]
        authorize_auth_token! :admin,    only: %i[invite destroy]

        before_action :set_membership, only: %i[destroy]

        # GET /api/v1/organization/members
        def index
          memberships = Current.organization
                               .organization_memberships
                               .includes(:user)
                               .order(created_at: :asc)

          json_response(members: memberships.map(&method(:membership_json)))
        end

        # POST /api/v1/organization/members/invite
        def invite
          email = params[:email].to_s.downcase.strip
          role  = params[:role].presence || 'assessor'

          return json_error('Valid email is required', :unprocessable_entity) if email.blank? || !email.match?(URI::MailTo::EMAIL_REGEXP)

          unless ::OrganizationMembership::ROLES.include?(role)
            return json_error("Invalid role. Must be 'admin' or 'assessor'", :unprocessable_entity)
          end

          # Find or provision placeholder user account for invited colleague
          user = ::User.find_by(email: email)
          user ||= ::User.create!(
            email:    email,
            password: SecureRandom.hex(16),
            role:     'user'
          )

          if Current.organization.organization_memberships.exists?(user_id: user.id)
            return json_error('User is already a member of this organization', :unprocessable_entity)
          end

          membership = Current.organization.organization_memberships.create!(
            user: user,
            role: role
          )

          json_response(
            {
              member:  membership_json(membership),
              message: "User #{email} has been successfully invited as #{role}"
            },
            :created
          )
        rescue ActiveRecord::RecordInvalid => e
          json_error(e.message, :unprocessable_entity)
        end

        # DELETE /api/v1/organization/members/:id
        def destroy
          if @membership.user_id == Current.user&.id
            return json_error('You cannot remove yourself from the organization', :unprocessable_entity)
          end

          @membership.destroy
          json_response(message: 'Member successfully removed from organization')
        end

        private

        def set_membership
          @membership = Current.organization.organization_memberships.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          json_error('Member not found', :not_found)
        end

        def membership_json(m)
          timestamp = m.created_at || m.updated_at || Time.current
          {
            id:         m.id,
            user_id:    m.user_id,
            email:      m.user.email,
            role:       m.role,
            joined_at:  timestamp.iso8601,
            created_at: timestamp.iso8601
          }
        end
      end
    end
  end
end
